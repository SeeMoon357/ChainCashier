import {
	encodeFunctionData,
	getAddress,
	parseUnits,
	padHex,
	type Hex,
} from 'viem';
import { getChainLabel, getUsdcAddress } from './businessChains';
import type { ExecutionPreview } from './executionRuntime';
import type { PlannerObjective } from './plannerRuntime';

const LIFI_INTENTS_MAINNET_BASE_URL = 'https://order.li.fi';
const INTENT_SOURCE_CHAIN_ID = 8453;
const INTENT_TARGET_CHAIN_ID = 42161;
const USDC_DECIMALS = 6;
const INPUT_SETTLER_ESCROW_ADDRESS = '0x000025c3226C00B2Cdc200005a1600509f4e00C0';
const POLYMER_ORACLE_MAINNET_ADDRESS = '0x0000003E06000007A224AeE90052fA6bb46d43C9';
const OUTPUT_SETTLER_ADDRESS = '0x0000000000eC36B683C2E6AC89e9A75989C22a2e';
const STANDARD_ORDER_COMPONENTS = [
	{ name: 'user', type: 'address' },
	{ name: 'nonce', type: 'uint256' },
	{ name: 'originChainId', type: 'uint256' },
	{ name: 'expires', type: 'uint32' },
	{ name: 'fillDeadline', type: 'uint32' },
	{ name: 'inputOracle', type: 'address' },
	{ name: 'inputs', type: 'uint256[2][]' },
	{
		name: 'outputs',
		type: 'tuple[]',
		components: [
			{ name: 'oracle', type: 'bytes32' },
			{ name: 'settler', type: 'bytes32' },
			{ name: 'chainId', type: 'uint256' },
			{ name: 'token', type: 'bytes32' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'recipient', type: 'bytes32' },
			{ name: 'call', type: 'bytes' },
			{ name: 'context', type: 'bytes' },
		],
	},
] as const;

type FetchLike = typeof fetch;

export type IntentToken = {
	symbol: 'USDC';
	address: string;
};

export type IntentInput = {
	user: string;
	asset: string;
	amount: string;
};

export type IntentOutput = {
	receiver: string;
	asset: string;
	amount: string | null;
};

export type IntentSwap = {
	intentType: 'oif-swap';
	inputs: IntentInput[];
	outputs: IntentOutput[];
	swapType: 'exact-input';
};

export type IntentQuoteRequest = {
	user: string;
	intent: IntentSwap;
	supportedTypes: ['oif-escrow-v0'];
};

export type IntentGoal = {
	asset: 'USDC';
	amount: number | null;
	sourceChain: number;
	targetChain: number;
	objective: PlannerObjective;
	userAddress: string;
};

export type LifiIntentsResult<T> =
	| {
			success: true;
			status: number;
			data: T;
	  }
	| {
			success: false;
			status: number | null;
			error: string;
			payload?: unknown;
	  };

export type IntentFlightStep = {
	key:
		| 'parse_goal'
		| 'build_intent'
		| 'request_solver_quote'
		| 'order_preview'
		| 'delivery_settlement_model';
	title: string;
	status: 'completed' | 'failed' | 'pending';
	summary: string;
};

export type IntentFlightRecord = {
	mode: 'lifi_intents';
	goal: IntentGoal;
	steps: IntentFlightStep[];
	quoteRequest: IntentQuoteRequest | null;
	quoteResult: LifiIntentsResult<unknown>;
	orderPreview: unknown | null;
	status: 'quote_ready' | 'quote_failed';
	educationSummary: string;
	classicRouteComparison: string;
	classicRoutePrompt: string;
};

type QuotePreviewEntry = {
	quoteId?: string;
	validUntil?: number;
	preview?: {
		inputs?: Array<{ amount?: string }>;
		outputs?: Array<{ amount?: string }>;
	};
};

type QuoteResponseLike = {
	quotes?: QuotePreviewEntry[];
};

type StandardOrder = {
	user: Hex;
	nonce: bigint;
	originChainId: bigint;
	expires: number;
	fillDeadline: number;
	inputOracle: Hex;
	inputs: Array<readonly [bigint, bigint]>;
	outputs: Array<{
		oracle: Hex;
		settler: Hex;
		chainId: bigint;
		token: Hex;
		amount: bigint;
		recipient: Hex;
		call: Hex;
		context: Hex;
	}>;
};

function isSupportedIntentRoute(input: {
	sourceChain: number;
	targetChain: number;
}): boolean {
	return (
		input.sourceChain === INTENT_SOURCE_CHAIN_ID &&
		input.targetChain === INTENT_TARGET_CHAIN_ID
	);
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
}

function addressToUint256(address: string): bigint {
	return BigInt(getAddress(address));
}

function addressToBytes32(address: string): Hex {
	return padHex(getAddress(address), { size: 32 });
}

function getBestQuote(data: unknown): QuotePreviewEntry | null {
	if (!data || typeof data !== 'object') {
		return null;
	}

	const quotes = (data as QuoteResponseLike).quotes;
	return Array.isArray(quotes) && quotes.length > 0 ? quotes[0] : null;
}

function formatUsdcBaseUnits(amount: string | undefined): string {
	if (!amount || !/^\d+$/.test(amount)) {
		return 'unknown USDC';
	}

	const units = BigInt(amount);
	const whole = units / BigInt(1_000_000);
	const fractional = (units % BigInt(1_000_000)).toString().padStart(6, '0');
	const trimmedFractional = fractional.replace(/0+$/, '');
	return `${whole.toString()}${trimmedFractional ? `.${trimmedFractional}` : ''} USDC`;
}

function formatGoalAmount(goal: IntentGoal): string {
	return goal.amount == null ? 'an unknown amount of USDC' : `${goal.amount} ${goal.asset}`;
}

function formatQuoteExpiry(validUntil: number | undefined): string {
	if (!validUntil) {
		return 'no explicit expiry returned';
	}

	return new Date(validUntil * 1000).toISOString();
}

function buildEscrowStandardOrder(input: {
	goal: IntentGoal;
	quote: QuotePreviewEntry;
}): StandardOrder | null {
	const inputAmount = input.quote.preview?.inputs?.[0]?.amount;
	const outputAmount = input.quote.preview?.outputs?.[0]?.amount;
	const fromToken = getUsdcAddress(INTENT_SOURCE_CHAIN_ID);
	const toToken = getUsdcAddress(INTENT_TARGET_CHAIN_ID);

	if (!inputAmount || !outputAmount || !fromToken || !toToken) {
		return null;
	}

	const now = Math.floor(Date.now() / 1000);
	const fillDeadline = input.quote.validUntil && input.quote.validUntil > now
		? input.quote.validUntil
		: now + 10 * 60;
	const expires = fillDeadline + 60 * 60;

	return {
		user: getAddress(input.goal.userAddress) as Hex,
		nonce: BigInt(Date.now()),
		originChainId: BigInt(INTENT_SOURCE_CHAIN_ID),
		expires,
		fillDeadline,
		inputOracle: getAddress(POLYMER_ORACLE_MAINNET_ADDRESS) as Hex,
		inputs: [[addressToUint256(fromToken), BigInt(inputAmount)]],
		outputs: [
			{
				oracle: addressToBytes32(POLYMER_ORACLE_MAINNET_ADDRESS),
				settler: addressToBytes32(OUTPUT_SETTLER_ADDRESS),
				chainId: BigInt(INTENT_TARGET_CHAIN_ID),
				token: addressToBytes32(toToken),
				amount: BigInt(outputAmount),
				recipient: addressToBytes32(input.goal.userAddress),
				call: '0x',
				context: '0x',
			},
		],
	};
}

function buildOpenEscrowCallData(order: StandardOrder): Hex {
	return encodeFunctionData({
		abi: [
			{
				type: 'function',
				name: 'open',
				stateMutability: 'nonpayable',
				inputs: [
					{
						name: 'order',
						type: 'tuple',
						components: STANDARD_ORDER_COMPONENTS,
					},
				],
				outputs: [],
			},
		],
		functionName: 'open',
		args: [order],
	});
}

export function encodeErc7930EvmAddress(
	chainId: number,
	address: string,
): string {
	const normalizedAddress = address.startsWith('0x') ? address.slice(2) : address;
	if (!/^[0-9a-fA-F]{40}$/.test(normalizedAddress)) {
		throw new Error('A valid 20-byte EVM address is required.');
	}

	const chainReference = chainId.toString(16);
	const paddedChainReference =
		chainReference.length % 2 === 0 ? chainReference : `0${chainReference}`;
	const encodedChainReference = paddedChainReference.toUpperCase();
	const chainReferenceLength = (paddedChainReference.length / 2)
		.toString(16)
		.padStart(2, '0');

	return `0x00010000${chainReferenceLength}${encodedChainReference}14${normalizedAddress}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
	const contentType = response.headers.get('content-type') || '';
	if (!contentType.includes('application/json')) {
		return response.text();
	}

	return response.json();
}

export function buildMainnetIntentQuoteRequest(input: {
	userAddress: string;
	amount: number | null;
	sourceChain: number;
	targetChain: number;
	objective?: PlannerObjective;
}):
	| { success: true; data: IntentQuoteRequest }
	| { success: false; error: string } {
	if (!isSupportedIntentRoute(input)) {
		return {
			success: false,
			error:
				'IntentLens MVP only supports Base USDC -> Arbitrum USDC for mainnet LI.FI Intents.',
		};
	}

	if (input.amount == null || !Number.isFinite(input.amount) || input.amount <= 0) {
		return {
			success: false,
			error: 'A positive USDC amount is required before requesting a mainnet intent quote.',
		};
	}

	const fromToken = getUsdcAddress(INTENT_SOURCE_CHAIN_ID);
	const toToken = getUsdcAddress(INTENT_TARGET_CHAIN_ID);
	if (!fromToken || !toToken) {
		return {
			success: false,
			error: 'USDC token configuration is missing for the supported Intents route.',
		};
	}

	return {
		success: true,
		data: {
			user: encodeErc7930EvmAddress(INTENT_SOURCE_CHAIN_ID, input.userAddress),
			intent: {
				intentType: 'oif-swap',
				inputs: [
					{
						user: encodeErc7930EvmAddress(
							INTENT_SOURCE_CHAIN_ID,
							input.userAddress,
						),
						asset: encodeErc7930EvmAddress(INTENT_SOURCE_CHAIN_ID, fromToken),
						amount: parseUnits(String(input.amount), USDC_DECIMALS).toString(),
					},
				],
				outputs: [
					{
						receiver: encodeErc7930EvmAddress(
							INTENT_TARGET_CHAIN_ID,
							input.userAddress,
						),
						asset: encodeErc7930EvmAddress(INTENT_TARGET_CHAIN_ID, toToken),
						amount: null,
					},
				],
				swapType: 'exact-input',
			},
			supportedTypes: ['oif-escrow-v0'],
		},
	};
}

export function createLifiIntentsClient(fetchImpl: FetchLike = fetch) {
	return {
		async requestQuote(
			request: IntentQuoteRequest,
		): Promise<LifiIntentsResult<unknown>> {
			try {
				const response = await fetchImpl(
					`${LIFI_INTENTS_MAINNET_BASE_URL}/quote/request`,
					{
						method: 'POST',
						cache: 'no-store',
						headers: {
							'content-type': 'application/json',
						},
						body: JSON.stringify(request),
					},
				);
				const payload = await parseJsonResponse(response);

				if (!response.ok) {
					return {
						success: false,
						status: response.status,
						error:
							typeof payload === 'string'
								? payload
								: `LI.FI Intents quote request failed with status ${response.status}.`,
						payload,
					};
				}

				return {
					success: true,
					status: response.status,
					data: payload,
				};
			} catch (error) {
				return {
					success: false,
					status: null,
					error: toErrorMessage(error),
				};
			}
		},
	};
}

function buildSucceededSteps(input: {
	goal: IntentGoal;
	quoteRequest: IntentQuoteRequest | null;
	quoteResult: LifiIntentsResult<unknown>;
}): IntentFlightStep[] {
	const bestQuote = input.quoteResult.success
		? getBestQuote(input.quoteResult.data)
		: null;
	const quotedInput = formatUsdcBaseUnits(bestQuote?.preview?.inputs?.[0]?.amount);
	const quotedOutput = formatUsdcBaseUnits(bestQuote?.preview?.outputs?.[0]?.amount);
	const quoteId = bestQuote?.quoteId ?? 'not returned';
	const expiry = formatQuoteExpiry(bestQuote?.validUntil);
	const fromChain = getChainLabel(input.goal.sourceChain);
	const toChain = getChainLabel(input.goal.targetChain);

	return [
		{
			key: 'parse_goal',
			title: 'Parse Goal',
			status: 'completed',
			summary: `IntentLens converted the request into a structured goal: ${formatGoalAmount(input.goal)} from ${fromChain} to ${toChain}, objective ${input.goal.objective}.`,
		},
		{
			key: 'build_intent',
			title: 'Build Intent',
			status: 'completed',
			summary: `The app built an exact-input LI.FI intent: source input ${quotedInput}, target output asset USDC on ${toChain}, receiver ${input.goal.userAddress}.`,
		},
		{
			key: 'request_solver_quote',
			title: 'Request Solver Quote',
			status: 'completed',
			summary: `LI.FI Intents returned quote ${quoteId}. Builders should treat this as solver-supplied data, not a route invented by the app.`,
		},
		{
			key: 'order_preview',
			title: 'Order Preview',
			status: 'completed',
			summary: `The preview asks the wallet to open an InputSettlerEscrow order before spending. Expected target output: ${quotedOutput}; quote valid until ${expiry}.`,
		},
		{
			key: 'delivery_settlement_model',
			title: 'Delivery / Settlement Model',
			status: 'pending',
			summary: 'After the Base order is opened, status moves from Signed to Delivered when a solver sends Arbitrum USDC, then Settled when the solver-side settlement finishes.',
		},
	];
}

function buildFailedSteps(error: string): IntentFlightStep[] {
	const steps = buildSucceededSteps({
		goal: {
			asset: 'USDC',
			amount: null,
			sourceChain: INTENT_SOURCE_CHAIN_ID,
			targetChain: INTENT_TARGET_CHAIN_ID,
			objective: 'best_received',
			userAddress: '0x0000000000000000000000000000000000000000',
		},
		quoteRequest: null,
		quoteResult: {
			success: false,
			status: null,
			error,
		},
	});
	return steps.map((step) =>
		step.key === 'request_solver_quote'
			? {
					...step,
					status: 'failed' as const,
					summary: `LI.FI Intents did not return an executable quote: ${error}`,
				}
			: step.key === 'order_preview' || step.key === 'delivery_settlement_model'
				? { ...step, status: 'pending' as const }
				: step,
	);
}

export function buildIntentFlightRecord(input: {
	goal: IntentGoal;
	quoteRequest: IntentQuoteRequest | null;
	quoteResult: LifiIntentsResult<unknown>;
}): IntentFlightRecord {
	const quoteSucceeded = input.quoteResult.success;
	const fromChain = getChainLabel(input.goal.sourceChain);
	const toChain = getChainLabel(input.goal.targetChain);
	const bestQuote = quoteSucceeded ? getBestQuote(input.quoteResult.data) : null;
	const quotedInput = formatUsdcBaseUnits(bestQuote?.preview?.inputs?.[0]?.amount);
	const quotedOutput = formatUsdcBaseUnits(bestQuote?.preview?.outputs?.[0]?.amount);
	const classicRoutePrompt = `Use classic route preview for ${formatGoalAmount(input.goal)} from ${fromChain} to ${toChain}. Do not use LI.FI Intents; show the classic LI.FI route-based flow for comparison.`;

	return {
		mode: 'lifi_intents',
		goal: input.goal,
		steps: quoteSucceeded
			? buildSucceededSteps(input)
			: buildFailedSteps(input.quoteResult.error),
		quoteRequest: input.quoteRequest,
		quoteResult: input.quoteResult,
		orderPreview: quoteSucceeded ? input.quoteResult.data : null,
		status: quoteSucceeded ? 'quote_ready' : 'quote_failed',
		educationSummary: quoteSucceeded
			? `This run asked LI.FI Intents for a real mainnet solver quote from ${fromChain} to ${toChain}. The order preview maps ${quotedInput} into an expected ${quotedOutput}, then opens an InputSettlerEscrow order only after wallet confirmation.`
			: `This run still teaches the LI.FI Intents path: the app built an intent, asked the solver marketplace for a quote, and surfaced the real failure instead of inventing solver output.`,
		classicRouteComparison:
			'Classic LI.FI route flow asks the routing API for concrete route steps first, then the user signs the route transaction. LI.FI Intents starts from the desired outcome, opens an escrow-backed order, lets solvers compete to deliver the output, and uses settlement to verify the result.',
		classicRoutePrompt,
	};
}

export function buildIntentExecutionPreview(input: {
	goal: IntentGoal;
	quoteResult: LifiIntentsResult<unknown>;
}): ExecutionPreview | null {
	if (!input.quoteResult.success) {
		return null;
	}

	const bestQuote = getBestQuote(input.quoteResult.data);
	if (!bestQuote) {
		return null;
	}

	const order = buildEscrowStandardOrder({
		goal: input.goal,
		quote: bestQuote,
	});
	const inputAmount = bestQuote.preview?.inputs?.[0]?.amount ?? null;
	const outputAmount = bestQuote.preview?.outputs?.[0]?.amount ?? null;
	const fromToken = getUsdcAddress(INTENT_SOURCE_CHAIN_ID);
	const toToken = getUsdcAddress(INTENT_TARGET_CHAIN_ID);

	if (!order || !inputAmount || !outputAmount || !fromToken || !toToken) {
		return null;
	}

	const callData = buildOpenEscrowCallData(order);
	return {
		canExecute: true,
		eligibility: 'ready',
		blockingReason: null,
		routeSource: 'live',
		fromChain: INTENT_SOURCE_CHAIN_ID,
		toChain: INTENT_TARGET_CHAIN_ID,
		fromToken: 'USDC',
		fromAmount: String(input.goal.amount ?? ''),
		targetVault: 'LI.FI Intents escrow order',
		targetVaultAddress: INPUT_SETTLER_ESCROW_ADDRESS,
		estimatedReceived: outputAmount,
		minimumReceived: outputAmount,
		fees: '$0.00',
		executionDurationSeconds: null,
		requiresApproval: true,
		approvalAddress: INPUT_SETTLER_ESCROW_ADDRESS,
		estimatedGasUsd: null,
		estimatedGasNative: null,
		executionKind: 'cross_chain',
		bridgeRequired: true,
		destinationChainLabel: getChainLabel(INTENT_TARGET_CHAIN_ID),
		routeStepsSummary: [
			'Approve Base USDC to the LI.FI InputSettlerEscrow contract',
			'Open the LI.FI Intents escrow order on Base',
			'Solvers can detect the opened intent and deliver Arbitrum USDC',
		],
		statusTrackingScope: 'source_tx_only',
		quote: {
			action: {
				fromAmount: inputAmount,
				fromToken: {
					address: fromToken,
					symbol: 'USDC',
				},
				toToken: {
					address: toToken,
					symbol: 'USDC',
					name: 'USD Coin',
				},
				fromChainId: INTENT_SOURCE_CHAIN_ID,
				toChainId: INTENT_TARGET_CHAIN_ID,
			},
			estimate: {
				approvalAddress: INPUT_SETTLER_ESCROW_ADDRESS,
				toAmount: outputAmount,
				toAmountMin: outputAmount,
				feeCosts: [],
				gasCosts: [],
			},
			tool: 'lifi-intents',
			toolDetails: {
				name: 'LI.FI Intents Escrow',
			},
			includedSteps: [],
			transactionRequest: {
				to: INPUT_SETTLER_ESCROW_ADDRESS,
				data: callData,
				value: '0',
			},
			transactionId: bestQuote.quoteId,
		},
	};
}

export async function requestMainnetIntentFlight(
	goal: IntentGoal,
	client: Pick<ReturnType<typeof createLifiIntentsClient>, 'requestQuote'> =
		createLifiIntentsClient(),
): Promise<IntentFlightRecord> {
	const request = buildMainnetIntentQuoteRequest({
		userAddress: goal.userAddress,
		amount: goal.amount,
		sourceChain: goal.sourceChain,
		targetChain: goal.targetChain,
		objective: goal.objective,
	});

	if (!request.success) {
		return buildIntentFlightRecord({
			goal,
			quoteRequest: null,
			quoteResult: {
				success: false,
				status: null,
				error: request.error,
			},
		});
	}

	const quoteResult = await client.requestQuote(request.data);
	return buildIntentFlightRecord({
		goal,
		quoteRequest: request.data,
		quoteResult,
	});
}

export async function requestMainnetIntentExecutionPreview(
	goal: IntentGoal,
	client: Pick<ReturnType<typeof createLifiIntentsClient>, 'requestQuote'> =
		createLifiIntentsClient(),
) {
	const record = await requestMainnetIntentFlight(goal, client);
	const preview = buildIntentExecutionPreview({
		goal: record.goal,
		quoteResult: record.quoteResult,
	});

	return { record, preview };
}
