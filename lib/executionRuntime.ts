import {
	getChainLabel,
	isSupportedCrossChainEarnPair,
} from './businessChains';

export type ExecutionEligibility =
	| 'ready'
	| 'blocked_missing_amount'
	| 'blocked_quote_failure'
	| 'blocked_wallet_context'
	| 'blocked_missing_approval_target'
	| 'blocked_insufficient_gas'
	| 'blocked_unsupported_cross_chain_pair';

export type ExecutionKind = 'same_chain' | 'cross_chain';
export type StatusTrackingScope = 'full_route' | 'source_tx_only';

export type ExecutionQuoteTransactionRequest = {
	to?: string;
	data?: string;
	value?: string;
	gasLimit?: string;
	gasPrice?: string;
};

export type ExecutionQuote = {
	action?: {
		fromAmount?: string;
		fromToken?: {
			address?: string;
			symbol?: string;
		};
		toToken?: {
			address?: string;
			symbol?: string;
			name?: string;
		};
		fromChainId?: number;
		toChainId?: number;
	};
	estimate?: {
		approvalAddress?: string;
		toAmount?: string;
		toAmountMin?: string;
		executionDuration?: number;
		feeCosts?: Array<{ amountUSD?: string }>;
		gasCosts?: Array<{
			amount?: string;
			amountUSD?: string;
			token?: { symbol?: string };
		}>;
	};
	tool?: string;
	toolDetails?: {
		name?: string;
	};
	includedSteps?: Array<{
		tool?: string;
		toolDetails?: {
			name?: string;
		};
		action?: {
			fromChainId?: number;
			toChainId?: number;
			toToken?: {
				symbol?: string;
				name?: string;
			};
		};
	}>;
	transactionRequest?: ExecutionQuoteTransactionRequest;
	transactionId?: string;
};

export type ExecutionPreview = {
	canExecute: boolean;
	eligibility: ExecutionEligibility;
	blockingReason: string | null;
	routeSource: 'live' | 'fallback';
	fromChain: number;
	toChain: number;
	fromToken: string;
	fromAmount: string | null;
	targetVault: string;
	targetVaultAddress: string;
	estimatedReceived: string | null;
	minimumReceived: string | null;
	fees: string;
	executionDurationSeconds: number | null;
	requiresApproval: boolean;
	approvalAddress: string | null;
	estimatedGasUsd: string | null;
	estimatedGasNative: string | null;
	executionKind: ExecutionKind;
	bridgeRequired: boolean;
	destinationChainLabel: string;
	routeStepsSummary: string[];
	statusTrackingScope: StatusTrackingScope;
	quote: ExecutionQuote | null;
};

type PreviewInput = {
	plan: {
		intent: string;
		asset: string;
		amount: number | null;
		sourceChain: number;
		targetChain: number;
		minApy: number | null;
		riskPreference: string;
		needsConfirmation: boolean;
		mode: string;
	};
	selectedVault: {
		address: string;
		name: string;
		displayName?: string;
		dataSource: 'live' | 'fallback';
	};
	quote: ExecutionQuote | null;
	quoteFailureReason?: string | null;
};

function hasValidAmount(amount: number | null): amount is number {
	return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

function getExecutionKind(fromChain: number, toChain: number): ExecutionKind {
	return fromChain === toChain ? 'same_chain' : 'cross_chain';
}

function summarizeRouteSteps(input: {
	fromChain: number;
	toChain: number;
	quote: ExecutionQuote | null;
	executionKind: ExecutionKind;
}): string[] {
	const summarized = (input.quote?.includedSteps ?? [])
		.filter((step) => step.tool !== 'feeCollection')
		.map((step) => {
			const toolName = step.toolDetails?.name ?? step.tool ?? 'LI.FI';
			if (step.tool === 'composer') {
				return `Deposit into the target vault with ${toolName}`;
			}

			if (
				typeof step.action?.fromChainId === 'number' &&
				typeof step.action?.toChainId === 'number' &&
				step.action.fromChainId !== step.action.toChainId
			) {
				return `Bridge from ${getChainLabel(step.action.fromChainId)} to ${getChainLabel(step.action.toChainId)} with ${toolName}`;
			}

			if (step.action?.toToken?.symbol) {
				return `Acquire ${step.action.toToken.symbol} with ${toolName}`;
			}

			return `Process with ${toolName}`;
		});

	if (summarized.length > 0) {
		return summarized;
	}

	return input.executionKind === 'cross_chain'
		? [
				`Bridge from ${getChainLabel(input.fromChain)} to ${getChainLabel(input.toChain)}`,
				'Deposit into the target vault',
			]
		: ['Deposit into the target vault'];
}

function sumUsdFees(feeCosts: Array<{ amountUSD?: string }> = []): string {
	const total = feeCosts.reduce((sum, item) => {
		const value = Number(item.amountUSD ?? 0);
		return Number.isFinite(value) ? sum + value : sum;
	}, 0);

	return total > 0 ? `$${total.toFixed(2)}` : '$0.00';
}

function sumGasAmounts(
	gasCosts:
		| Array<{
				amount?: string;
				amountUSD?: string;
				token?: { symbol?: string };
		  }>
		| undefined,
) {
	const totals = (gasCosts ?? []).reduce(
		(acc, cost) => {
			const usd = Number(cost.amountUSD ?? 0);
			if (Number.isFinite(usd)) {
				acc.usd += usd;
			}

			if (!acc.symbol && cost.token?.symbol) {
				acc.symbol = cost.token.symbol;
			}

			try {
				if (cost.amount) {
					acc.native += BigInt(cost.amount);
				}
			} catch {
				// Ignore malformed gas amounts and keep deterministic output.
			}

			return acc;
		},
		{ usd: 0, native: BigInt(0), symbol: '' },
	);

	return {
		usd:
			totals.usd > 0
				? `$${totals.usd.toFixed(2)}`
				: null,
		native:
			totals.native > 0
				? `${totals.native.toString()}${totals.symbol ? ` ${totals.symbol}` : ''}`
				: null,
	};
}

export function buildExecutionPreview(input: PreviewInput): ExecutionPreview {
	const executionKind = getExecutionKind(
		input.plan.sourceChain,
		input.plan.targetChain,
	);
	const bridgeRequired = executionKind === 'cross_chain';
	const destinationChainLabel = getChainLabel(input.plan.targetChain);
	const statusTrackingScope: StatusTrackingScope =
		executionKind === 'cross_chain' ? 'source_tx_only' : 'full_route';
	const routeStepsSummary = summarizeRouteSteps({
		fromChain: input.plan.sourceChain,
		toChain: input.plan.targetChain,
		quote: input.quote,
		executionKind,
	});

	if (!hasValidAmount(input.plan.amount)) {
		return {
			canExecute: false,
			eligibility: 'blocked_missing_amount',
			blockingReason:
				'A USDC amount is required before execution can proceed.',
			routeSource: input.selectedVault.dataSource,
			fromChain: input.plan.sourceChain,
			toChain: input.plan.targetChain,
			fromToken: input.plan.asset,
			fromAmount: null,
			targetVault: input.selectedVault.displayName ?? input.selectedVault.name,
			targetVaultAddress: input.selectedVault.address,
			estimatedReceived: null,
			minimumReceived: null,
			fees: '$0.00',
			executionDurationSeconds: null,
			requiresApproval: false,
			approvalAddress: null,
			estimatedGasUsd: null,
			estimatedGasNative: null,
			executionKind,
			bridgeRequired,
			destinationChainLabel,
			routeStepsSummary,
			statusTrackingScope,
			quote: input.quote,
		};
	}

	if (
		executionKind === 'cross_chain' &&
		!isSupportedCrossChainEarnPair(
			input.plan.sourceChain,
			input.plan.targetChain,
		)
	) {
		return {
			canExecute: false,
			eligibility: 'blocked_unsupported_cross_chain_pair',
			blockingReason:
				'This cross-chain Earn pair is not enabled in this version yet.',
			routeSource: input.selectedVault.dataSource,
			fromChain: input.plan.sourceChain,
			toChain: input.plan.targetChain,
			fromToken: input.plan.asset,
			fromAmount: String(input.plan.amount),
			targetVault: input.selectedVault.displayName ?? input.selectedVault.name,
			targetVaultAddress: input.selectedVault.address,
			estimatedReceived: input.quote?.estimate?.toAmount ?? null,
			minimumReceived: input.quote?.estimate?.toAmountMin ?? null,
			fees: sumUsdFees(input.quote?.estimate?.feeCosts),
			executionDurationSeconds: input.quote?.estimate?.executionDuration ?? null,
			requiresApproval: false,
			approvalAddress: input.quote?.estimate?.approvalAddress ?? null,
			estimatedGasUsd: sumGasAmounts(input.quote?.estimate?.gasCosts).usd,
			estimatedGasNative: sumGasAmounts(input.quote?.estimate?.gasCosts).native,
			executionKind,
			bridgeRequired,
			destinationChainLabel,
			routeStepsSummary,
			statusTrackingScope,
			quote: input.quote,
		};
	}

	if (input.quote == null) {
		return {
			canExecute: false,
			eligibility: 'blocked_quote_failure',
			blockingReason:
				input.quoteFailureReason?.trim() ||
				'Live LI.FI quote data is unavailable right now.',
			routeSource: input.selectedVault.dataSource,
			fromChain: input.plan.sourceChain,
			toChain: input.plan.targetChain,
			fromToken: input.plan.asset,
			fromAmount: String(input.plan.amount),
			targetVault: input.selectedVault.displayName ?? input.selectedVault.name,
			targetVaultAddress: input.selectedVault.address,
			estimatedReceived: null,
			minimumReceived: null,
			fees: '$0.00',
			executionDurationSeconds: null,
			requiresApproval: false,
			approvalAddress: null,
			estimatedGasUsd: null,
			estimatedGasNative: null,
			executionKind,
			bridgeRequired,
			destinationChainLabel,
			routeStepsSummary,
			statusTrackingScope,
			quote: null,
		};
	}

	if (!input.quote.estimate?.approvalAddress) {
		return {
			canExecute: false,
			eligibility: 'blocked_missing_approval_target',
			blockingReason:
				'LI.FI quote is missing the approval target required for ERC20 execution.',
			routeSource: 'live',
			fromChain: input.plan.sourceChain,
			toChain: input.plan.targetChain,
			fromToken: input.plan.asset,
			fromAmount: String(input.plan.amount),
			targetVault: input.selectedVault.displayName ?? input.selectedVault.name,
			targetVaultAddress: input.selectedVault.address,
			estimatedReceived: input.quote.estimate?.toAmount ?? null,
			minimumReceived: input.quote.estimate?.toAmountMin ?? null,
			fees: sumUsdFees(input.quote.estimate?.feeCosts),
			executionDurationSeconds: input.quote.estimate?.executionDuration ?? null,
			requiresApproval: false,
			approvalAddress: null,
			estimatedGasUsd: sumGasAmounts(input.quote.estimate?.gasCosts).usd,
			estimatedGasNative: sumGasAmounts(input.quote.estimate?.gasCosts).native,
			executionKind,
			bridgeRequired,
			destinationChainLabel,
			routeStepsSummary,
			statusTrackingScope,
			quote: input.quote,
		};
	}

	const gasSummary = sumGasAmounts(input.quote.estimate?.gasCosts);

	return {
		canExecute:
			Boolean(
				input.quote.transactionRequest?.to && input.quote.transactionRequest?.data,
			),
		eligibility:
			input.quote.transactionRequest?.to && input.quote.transactionRequest?.data
				? 'ready'
				: 'blocked_quote_failure',
		blockingReason:
			input.quote.transactionRequest?.to && input.quote.transactionRequest?.data
				? null
				: 'LI.FI quote is missing executable transaction data.',
		routeSource: 'live',
		fromChain: input.plan.sourceChain,
		toChain: input.plan.targetChain,
		fromToken: input.plan.asset,
		fromAmount: String(input.plan.amount),
		targetVault: input.selectedVault.displayName ?? input.selectedVault.name,
		targetVaultAddress: input.selectedVault.address,
		estimatedReceived: input.quote.estimate?.toAmount ?? null,
		minimumReceived: input.quote.estimate?.toAmountMin ?? null,
		fees: sumUsdFees(input.quote.estimate?.feeCosts),
		executionDurationSeconds: input.quote.estimate?.executionDuration ?? null,
		requiresApproval: true,
		approvalAddress: input.quote.estimate?.approvalAddress ?? null,
		estimatedGasUsd: gasSummary.usd,
		estimatedGasNative: gasSummary.native,
		executionKind,
		bridgeRequired,
		destinationChainLabel,
		routeStepsSummary,
		statusTrackingScope,
		quote: input.quote,
	};
}

export function collectTransactionHashes(route: {
	steps?: Array<{
		execution?: {
			process?: Array<{ txHash?: string | null | undefined }>;
		};
	}>;
} | null): string[] {
	if (!route?.steps) {
		return [];
	}

	const hashes = new Set<string>();
	for (const step of route.steps) {
		for (const process of step.execution?.process ?? []) {
			if (typeof process.txHash === 'string' && process.txHash) {
				hashes.add(process.txHash);
			}
		}
	}

	return [...hashes];
}
