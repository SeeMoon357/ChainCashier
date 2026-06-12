import { getPublicClient, getWalletClient } from '@wagmi/core';
import { erc20Abi, type Address, type Hex } from 'viem';
import { getExplorerTxBaseUrl } from './businessChains';
import {
	buildApproveRequest,
	runExecutionPreflight,
	type ExecutionPreflightResult,
} from './executionHelpers';
import { normalizeExecutionError } from './executionErrors';
import type { ExecutionPreview } from './executionRuntime';
import { createLifiClient } from './lifiClient';
import {
	resolveLifiRouteStatus,
	type LifiStatusResponse,
	type LifiRouteStatus,
} from './lifiStatus';
import { requestMainnetIntentExecutionPreview } from './lifiIntents';
import {
	extractIntentOrderIdFromLogs,
	fetchLifiIntentOrderStatus,
	type LifiIntentOrderStatus,
	type NormalizedLifiIntentStatus,
} from './lifiIntentStatus';
import { wagmiConfig } from './wagmi.config';

export type ClientExecutionState = {
	status:
		| 'idle'
		| 'preflighting'
		| 'awaiting_wallet_approval'
		| 'approving'
		| 'approved'
		| 'awaiting_wallet_execution'
		| 'submitting'
		| 'submitted'
		| 'tracking_route'
		| 'confirmed'
		| 'failed';
	txHashes: string[];
	explorerLinks: string[];
	approvalTxHash?: string;
	executionTxHash?: string;
	routeStatus?: LifiRouteStatus;
	routeSubstatus?: string;
	routeMessage?: string;
	routeReceivingChainId?: number;
	routeReceivingTokenSymbol?: string;
	routeReceivingTxHash?: string;
	routeReceivingExplorerLink?: string;
	intentOrderId?: string;
	intentOrderStatus?: LifiIntentOrderStatus;
	intentOrderIdentifier?: string;
	intentDeliveredAt?: string;
	intentSettledAt?: string;
	intentStatusError?: string;
	errorCode?: string;
	error?: string;
	completedAt?: string;
	preflight?: ExecutionPreflightResult;
};

type QuoteTransactionRequest = {
	to?: string;
	data?: string;
	value?: string;
	gasLimit?: string;
	gasPrice?: string;
};

const RECEIPT_TIMEOUT_MS = 120_000;
const ROUTE_STATUS_POLL_INTERVAL_MS = 10_000;
const ROUTE_STATUS_TIMEOUT_MS = 300_000;
const INTENT_STATUS_POLL_INTERVAL_MS = 5_000;
const INTENT_STATUS_TIMEOUT_MS = 180_000;
const lifiClient = createLifiClient();

function toExplorerLink(chainId: number, hash: string) {
	return `${getExplorerTxBaseUrl(chainId)}${hash}`;
}

function toHashes(state: {
	approvalTxHash?: string;
	executionTxHash?: string;
	chainId: number;
}) {
	const hashes = [state.approvalTxHash, state.executionTxHash].filter(
		(value): value is string => Boolean(value),
	);
	return {
		txHashes: hashes,
		explorerLinks: hashes.map((hash) => toExplorerLink(state.chainId, hash)),
	};
}

function requestFromPreview(preview: ExecutionPreview): QuoteTransactionRequest | null {
	if (!preview.quote || typeof preview.quote !== 'object') {
		return null;
	}

	return preview.quote.transactionRequest ?? null;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRouteBridge(preview: ExecutionPreview): string | undefined {
	if (preview.quote?.tool && preview.quote.tool !== 'composer') {
		return preview.quote.tool;
	}

	return preview.quote?.includedSteps?.find(
		(step) =>
			step.tool &&
			step.tool !== 'composer' &&
			step.tool !== 'feeCollection',
	)?.tool;
}

function isIntentEscrowPreview(preview: ExecutionPreview): boolean {
	return preview.quote?.tool === 'lifi-intents';
}

async function refreshIntentEscrowPreview(input: {
	preview: ExecutionPreview;
	walletAddress: Address;
}): Promise<ExecutionPreview> {
	const amount = Number(input.preview.fromAmount);
	if (!Number.isFinite(amount) || amount <= 0) {
		throw new Error('Cannot refresh LI.FI Intents quote because the amount is invalid.');
	}

	const { record, preview } = await requestMainnetIntentExecutionPreview({
		asset: 'USDC',
		amount,
		sourceChain: input.preview.fromChain,
		targetChain: input.preview.toChain,
		objective: 'best_received',
		userAddress: input.walletAddress,
	});

	if (!preview) {
		const error = record.quoteResult.success
			? 'LI.FI Intents did not return an executable fresh order.'
			: record.quoteResult.error;
		throw new Error(`Fresh LI.FI Intents quote failed: ${error}`);
	}

	return preview;
}

async function preflightIntentEscrowOpen(input: {
	publicClient: NonNullable<ReturnType<typeof getPublicClient>>;
	account: Address;
	request: QuoteTransactionRequest;
	nativeBalance: bigint;
}) {
	if (!input.request.to || !input.request.data) {
		throw new Error('LI.FI Intents escrow transaction data is incomplete.');
	}

	let gas: bigint;
	try {
		gas = await input.publicClient.estimateGas({
			account: input.account,
			to: input.request.to as Address,
			data: input.request.data as Hex,
			value: input.request.value ? BigInt(input.request.value) : BigInt(0),
		});
	} catch {
		throw new Error(
			'LI.FI Intents escrow open transaction reverted during gas simulation.',
		);
	}

	const gasPrice = await input.publicClient.getGasPrice();
	const estimatedCost = gas * gasPrice;
	if (input.nativeBalance < estimatedCost) {
		throw new Error(
			'Not enough Base ETH is available for the LI.FI Intents escrow open transaction.',
		);
	}
}

function buildRouteTrackingState(input: {
	status: ClientExecutionState['status'];
	chainId: number;
	approvalTxHash?: string;
	executionTxHash?: string;
	preflight?: ExecutionPreflightResult;
	routeStatus: LifiRouteStatus;
	routeSubstatus: string | null;
	routeMessage: string;
	routeReceivingChainId: number | null;
	routeReceivingTokenSymbol: string | null;
	routeReceivingTxHash: string | null;
	error?: string;
	errorCode?: string;
	completedAt?: string;
}) {
	const routeReceivingExplorerLink =
		input.routeReceivingChainId != null && input.routeReceivingTxHash
			? toExplorerLink(input.routeReceivingChainId, input.routeReceivingTxHash)
			: undefined;

	return {
		status: input.status,
		approvalTxHash: input.approvalTxHash,
		executionTxHash: input.executionTxHash,
		...toHashes({
			approvalTxHash: input.approvalTxHash,
			executionTxHash: input.executionTxHash,
			chainId: input.chainId,
		}),
		preflight: input.preflight,
		routeStatus: input.routeStatus,
		routeSubstatus: input.routeSubstatus ?? undefined,
		routeMessage: input.routeMessage,
		routeReceivingChainId: input.routeReceivingChainId ?? undefined,
		routeReceivingTokenSymbol: input.routeReceivingTokenSymbol ?? undefined,
		routeReceivingTxHash: input.routeReceivingTxHash ?? undefined,
		routeReceivingExplorerLink,
		error: input.error,
		errorCode: input.errorCode,
		completedAt: input.completedAt,
	} satisfies ClientExecutionState;
}

function applyIntentStatusToState(input: {
	baseState: ClientExecutionState;
	status: NormalizedLifiIntentStatus;
}) {
	return {
		...input.baseState,
		intentOrderId: input.status.orderId ?? input.baseState.intentOrderId,
		intentOrderStatus: input.status.orderStatus,
		intentOrderIdentifier: input.status.orderIdentifier ?? undefined,
		intentDeliveredAt: input.status.deliveredAt ?? undefined,
		intentSettledAt: input.status.settledAt ?? undefined,
		routeReceivingTxHash: input.status.deliveredTxHash ?? undefined,
		routeReceivingExplorerLink: input.status.deliveryExplorerLink ?? undefined,
		routeMessage:
			input.status.orderStatus === 'Settled'
				? 'LI.FI Intents order settled.'
				: input.status.deliveredTxHash
					? 'Solver delivered the target-chain USDC.'
					: 'Opened on Base, waiting for solver delivery.',
	} satisfies ClientExecutionState;
}

async function trackIntentOrderStatus(input: {
	orderId: string;
	baseState: ClientExecutionState;
	onStateChange: (state: ClientExecutionState) => void;
}) {
	const startedAt = Date.now();
	let lastState: ClientExecutionState = {
		...input.baseState,
		intentOrderId: input.orderId,
		intentOrderStatus: 'Signed' as const,
		routeMessage: 'Opened on Base, waiting for solver delivery.',
	};
	input.onStateChange(lastState);

	while (Date.now() - startedAt < INTENT_STATUS_TIMEOUT_MS) {
		try {
			const status = await fetchLifiIntentOrderStatus(input.orderId);
			lastState = applyIntentStatusToState({
				baseState: lastState,
				status,
			});
			input.onStateChange(lastState);

			if (status.deliveredTxHash || status.settledTxHash) {
				return;
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'LI.FI Intents status is unavailable. Check again later.';
			const isNotIndexedYet = /status 404/i.test(message);
			lastState = {
				...lastState,
				intentStatusError: isNotIndexedYet ? undefined : message,
				routeMessage: isNotIndexedYet
					? 'Opened on Base. LI.FI Intents status is not indexed yet; still polling.'
					: 'Opened on Base. LI.FI Intents status is unavailable; check again later.',
			};
			input.onStateChange(lastState);
		}

		await sleep(INTENT_STATUS_POLL_INTERVAL_MS);
	}

	input.onStateChange({
		...lastState,
		routeMessage:
			lastState.routeReceivingTxHash
				? lastState.routeMessage
				: 'Opened on Base. Solver delivery is still pending.',
	});
}

async function trackCrossChainRouteStatus(input: {
	preview: ExecutionPreview;
	chainId: number;
	approvalTxHash?: Hex;
	executionTxHash: Hex;
	preflight?: ExecutionPreflightResult;
	onStateChange: (state: ClientExecutionState) => void;
}) {
	const startedAt = Date.now();
	const bridge = getRouteBridge(input.preview);
	let lastRouteMessage =
		'Source-chain route confirmed. Tracking final LI.FI route status.';

	while (Date.now() - startedAt < ROUTE_STATUS_TIMEOUT_MS) {
		const statusResult = await lifiClient.getStatus({
			txHash: input.executionTxHash,
			fromChain: input.preview.fromChain,
			toChain: input.preview.toChain,
			bridge,
		});

		if (statusResult.success) {
			const resolved = resolveLifiRouteStatus(
				statusResult.data as LifiStatusResponse,
			);
			lastRouteMessage = resolved.message;

			input.onStateChange(
				buildRouteTrackingState({
					status: resolved.clientStatus,
					chainId: input.chainId,
					approvalTxHash: input.approvalTxHash,
					executionTxHash: input.executionTxHash,
					preflight: input.preflight,
					routeStatus: resolved.routeStatus,
					routeSubstatus: resolved.substatus,
					routeMessage: resolved.message,
					routeReceivingChainId: resolved.receivingChainId,
					routeReceivingTokenSymbol: resolved.receivingTokenSymbol,
					routeReceivingTxHash: resolved.receivingTxHash,
					error:
						resolved.clientStatus === 'failed' ? resolved.message : undefined,
					errorCode:
						resolved.routeStatus === 'refunded'
							? 'route_refunded'
							: resolved.clientStatus === 'failed'
								? 'route_failed'
								: undefined,
					completedAt:
						resolved.clientStatus === 'tracking_route'
							? undefined
							: new Date().toISOString(),
				}),
			);

			if (resolved.clientStatus !== 'tracking_route') {
				return;
			}
		}

		await sleep(ROUTE_STATUS_POLL_INTERVAL_MS);
	}

	input.onStateChange(
		buildRouteTrackingState({
			status: 'tracking_route',
			chainId: input.chainId,
			approvalTxHash: input.approvalTxHash,
			executionTxHash: input.executionTxHash,
			preflight: input.preflight,
			routeStatus: 'pending',
			routeSubstatus: null,
			routeMessage: `${lastRouteMessage} Final LI.FI route status is still pending.`,
			routeReceivingChainId: null,
			routeReceivingTokenSymbol: null,
			routeReceivingTxHash: null,
		}),
	);
}

export async function executePreviewTransaction(input: {
	preview: ExecutionPreview;
	switchChainAsync?: ((args: { chainId: number }) => Promise<unknown>) | undefined;
	onStateChange: (state: ClientExecutionState) => void;
}) {
	const chainId = input.preview.fromChain as (typeof wagmiConfig.chains)[number]['id'];
	let activePreview = input.preview;
	let preflight: ExecutionPreflightResult | undefined;
	let approvalTxHash: Hex | undefined;
	let executionTxHash: Hex | undefined;

	input.onStateChange({
		status: 'preflighting',
		txHashes: [],
		explorerLinks: [],
	});

	try {
		if (input.switchChainAsync) {
			await input.switchChainAsync({ chainId: input.preview.fromChain });
		}

		const walletClient = await getWalletClient(wagmiConfig, {
			chainId,
		});

		if (!walletClient || !walletClient.account) {
			throw new Error('Wallet client is unavailable. Reconnect your wallet and try again.');
		}

		const walletAddress = walletClient.account.address;
		const publicClient = getPublicClient(wagmiConfig, {
			chainId,
		});

		if (!publicClient) {
			throw new Error('Public client is unavailable for receipt tracking.');
		}

		const nativeBalance = await publicClient.getBalance({
			address: walletAddress,
		});

		const tokenAddress = input.preview.quote?.action?.fromToken?.address;
		const approvalAddress = input.preview.approvalAddress;
		let allowance = BigInt(0);

		if (tokenAddress && approvalAddress) {
			allowance = (await publicClient.readContract({
				address: tokenAddress as Address,
				abi: erc20Abi,
				functionName: 'allowance',
				args: [walletAddress, approvalAddress as Address],
			})) as bigint;
		}

		preflight = runExecutionPreflight({
			preview: {
				fromChain: input.preview.fromChain,
				toChain: input.preview.toChain,
				quote: input.preview.quote,
			},
			wallet: {
				address: walletAddress,
				chainId,
				nativeBalance,
				allowance,
			},
		});

		input.onStateChange({
			status: 'preflighting',
			...toHashes({ chainId }),
			preflight,
		});

		if (!preflight.ready) {
			const reasonMap: Record<NonNullable<ExecutionPreflightResult['reason']>, string> = {
				blocked_quote_failure:
					'Execution quote is incomplete or unsupported for this version.',
				blocked_wallet_context:
					'Wallet context is invalid. Reconnect and switch to the correct chain.',
				blocked_missing_approval_target:
					'LI.FI quote is missing the approval target required for USDC execution.',
				blocked_insufficient_gas:
					'Not enough native gas token is available to submit this transaction.',
				blocked_unsupported_cross_chain_pair:
					'This cross-chain USDC Earn pair is not enabled in this version.',
			};
			throw new Error(reasonMap[preflight.reason ?? 'blocked_quote_failure']);
		}

		if (preflight.requiresApproval) {
			if (!tokenAddress || !preflight.approvalAddress || !preflight.amountBaseUnits) {
				throw new Error('Approval data is incomplete. Cannot request ERC20 approval.');
			}

			input.onStateChange({
				status: 'awaiting_wallet_approval',
				...toHashes({ approvalTxHash, chainId }),
				preflight,
			});

			const approveRequest = buildApproveRequest({
				tokenAddress,
				spender: preflight.approvalAddress,
				amount: preflight.amountBaseUnits,
			});
			approvalTxHash = await walletClient.sendTransaction({
				account: walletClient.account,
				to: approveRequest.to as Address,
				data: approveRequest.data as Hex,
				value: approveRequest.value,
			});

			input.onStateChange({
				status: 'approving',
				approvalTxHash,
				...toHashes({ approvalTxHash, chainId }),
				preflight,
			});

			const approvalReceipt = await publicClient.waitForTransactionReceipt({
				hash: approvalTxHash,
				timeout: RECEIPT_TIMEOUT_MS,
				onReplaced: (replacement) => {
					if (replacement.reason === 'cancelled') {
						throw new Error(
							'USDC approval transaction was cancelled in the wallet before confirmation.',
						);
					}

					approvalTxHash = replacement.transaction.hash;
					input.onStateChange({
						status: 'approving',
						approvalTxHash,
						...toHashes({ approvalTxHash, chainId }),
						preflight,
					});
				},
			});

			if (approvalReceipt.status !== 'success') {
				throw new Error('USDC approval reverted on chain.');
			}

			input.onStateChange({
				status: 'approved',
				approvalTxHash,
				...toHashes({ approvalTxHash, chainId }),
				preflight,
			});
		}

		if (isIntentEscrowPreview(activePreview)) {
			activePreview = await refreshIntentEscrowPreview({
				preview: activePreview,
				walletAddress,
			});

			const refreshedTokenAddress = activePreview.quote?.action?.fromToken?.address;
			const refreshedApprovalAddress = activePreview.approvalAddress;
			let refreshedAllowance = BigInt(0);
			if (refreshedTokenAddress && refreshedApprovalAddress) {
				refreshedAllowance = (await publicClient.readContract({
					address: refreshedTokenAddress as Address,
					abi: erc20Abi,
					functionName: 'allowance',
					args: [walletAddress, refreshedApprovalAddress as Address],
				})) as bigint;
			}

			preflight = runExecutionPreflight({
				preview: {
					fromChain: activePreview.fromChain,
					toChain: activePreview.toChain,
					quote: activePreview.quote,
				},
				wallet: {
					address: walletAddress,
					chainId,
					nativeBalance,
					allowance: refreshedAllowance,
				},
			});

			if (!preflight.ready) {
				throw new Error(
					'Fresh LI.FI Intents quote is not executable after approval. Request a new quote and try again.',
				);
			}

			input.onStateChange({
				status: approvalTxHash ? 'approved' : 'preflighting',
				approvalTxHash,
				...toHashes({ approvalTxHash, chainId }),
				preflight,
				routeMessage: approvalTxHash
					? 'Fresh LI.FI Intents quote prepared after approval.'
					: 'Fresh LI.FI Intents quote prepared before escrow open.',
			});
		}

		const request = requestFromPreview(activePreview);
		if (!request?.to || !request?.data) {
			throw new Error('LI.FI quote is missing transactionRequest data.');
		}

		if (isIntentEscrowPreview(activePreview)) {
			await preflightIntentEscrowOpen({
				publicClient,
				account: walletClient.account.address,
				request,
				nativeBalance,
			});
		}

		input.onStateChange({
			status: 'awaiting_wallet_execution',
			approvalTxHash,
			...toHashes({ approvalTxHash, chainId }),
			preflight,
		});

		executionTxHash = await walletClient.sendTransaction({
			account: walletClient.account,
			to: request.to as Address,
			data: request.data as Hex,
			value: request.value ? BigInt(request.value) : BigInt(0),
			gas: request.gasLimit ? BigInt(request.gasLimit) : undefined,
			gasPrice: request.gasPrice ? BigInt(request.gasPrice) : undefined,
		});

		input.onStateChange({
			status: 'submitting',
			approvalTxHash,
			executionTxHash,
			...toHashes({ approvalTxHash, executionTxHash, chainId }),
			preflight,
		});

		const receipt = await publicClient.waitForTransactionReceipt({
			hash: executionTxHash,
			timeout: RECEIPT_TIMEOUT_MS,
			onReplaced: (replacement) => {
				if (replacement.reason === 'cancelled') {
					throw new Error(
						'Deposit transaction was cancelled in the wallet before confirmation.',
					);
				}

				executionTxHash = replacement.transaction.hash;
				input.onStateChange({
					status: 'submitting',
					approvalTxHash,
					executionTxHash,
					...toHashes({ approvalTxHash, executionTxHash, chainId }),
					preflight,
				});
			},
		});
		const succeeded = receipt.status === 'success';

		if (
			succeeded &&
			activePreview.executionKind === 'cross_chain' &&
			!isIntentEscrowPreview(activePreview)
		) {
			input.onStateChange(
				buildRouteTrackingState({
					status: 'tracking_route',
					chainId,
					approvalTxHash,
					executionTxHash,
					preflight,
					routeStatus: 'pending',
					routeSubstatus: null,
					routeMessage:
						'Source-chain route confirmed. Tracking final LI.FI route status.',
					routeReceivingChainId: null,
					routeReceivingTokenSymbol: null,
					routeReceivingTxHash: null,
				}),
			);

			await trackCrossChainRouteStatus({
				preview: activePreview,
				chainId,
				approvalTxHash,
				executionTxHash,
				preflight,
				onStateChange: input.onStateChange,
			});

			return {
				hash: executionTxHash,
				approvalTxHash,
				receipt,
			};
		}

		const confirmedState = {
			status: succeeded ? 'confirmed' : 'failed',
			approvalTxHash,
			executionTxHash,
			...toHashes({ approvalTxHash, executionTxHash, chainId }),
			preflight,
			completedAt: new Date().toISOString(),
			errorCode: succeeded ? undefined : 'onchain_revert',
			error: succeeded
				? undefined
				: isIntentEscrowPreview(activePreview)
					? 'Intent open transaction reverted on chain.'
					: 'Deposit transaction reverted on chain.',
		} satisfies ClientExecutionState;

		input.onStateChange(confirmedState);

		if (succeeded && isIntentEscrowPreview(activePreview)) {
			const orderId = extractIntentOrderIdFromLogs(receipt.logs);
			if (orderId) {
				await trackIntentOrderStatus({
					orderId,
					baseState: confirmedState,
					onStateChange: input.onStateChange,
				});
			} else {
				input.onStateChange({
					...confirmedState,
					intentStatusError:
						'Intent order id was not found in the Base open transaction logs.',
					routeMessage:
						'Opened on Base. Intent order id was not found for delivery tracking.',
				});
			}
		}

		return {
			hash: executionTxHash,
			approvalTxHash,
			receipt,
		};
	} catch (error) {
		input.onStateChange(
			buildFailedExecutionState({
				chainId,
				error,
				approvalTxHash,
				executionTxHash,
				preflight,
			}),
		);
		throw error;
	}
}

export function buildFailedExecutionState(input: {
	chainId: number;
	error: unknown;
	approvalTxHash?: string;
	executionTxHash?: string;
	preflight?: ExecutionPreflightResult;
}): ClientExecutionState {
	const normalized = normalizeExecutionError(input.error);
	return {
		status: 'failed',
		approvalTxHash: input.approvalTxHash,
		executionTxHash: input.executionTxHash,
		...toHashes({
			approvalTxHash: input.approvalTxHash,
			executionTxHash: input.executionTxHash,
			chainId: input.chainId,
		}),
		errorCode: normalized.errorCode,
		error: normalized.error,
		preflight: input.preflight,
		completedAt: new Date().toISOString(),
	};
}
