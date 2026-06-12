import { tool } from 'ai';
import { z } from 'zod';
import {
	buildDepositQuote,
	getPortfolioPositions,
	getVaultDetails,
	searchVaults,
	selectRecommendedVault,
	type SearchVaultsResult,
} from '@/lib/lifiDomain';
import { createAgentStepEvent, type AgentStepEvent } from '@/lib/agentSteps';
import { getChainLabel } from '@/lib/businessChains';
import type { ExecutionQuote } from '@/lib/executionRuntime';
import { summarizeVaultSearchOutcome } from '@/lib/lifiRuntime';
import type { PlannerOutput } from '@/lib/plannerRuntime';

export type EarnToolName =
	| 'listVaults'
	| 'getVaultDetail'
	| 'getPortfolio'
	| 'estimateYield'
	| 'buildComposerQuote';

export type AgentToolResult<T> =
	| {
			success: true;
			data: T;
			summary: string;
	  }
	| {
			success: false;
			error: string;
			summary: string;
			data?: null;
	  };

export type ListVaultsToolData = {
	chainId: number;
	count: number;
	totalCount: number;
	transactionalCount: number;
	selectedVault: {
		address: string;
		name: string;
		protocol: string;
		apy: string;
		tvl: number;
		underlyingTokens: string[];
		tags: string[];
		openForDeposits: boolean;
	} | null;
	alternatives: Array<{
		address: string;
		name: string;
		protocol: string;
		apy: string;
		tvl: number;
		underlyingTokens: string[];
		tags: string[];
		openForDeposits: boolean;
	}>;
	thresholdSatisfied: boolean;
};

export type VaultDetailToolData = {
	vault: {
		address: string;
		name: string;
		protocol: string;
		apy: string;
		tvl: number;
		underlyingTokens: string[];
		assetAddress: string;
		descriptions: Record<string, string>;
		auditLinks: string[];
	};
};

export type PortfolioToolData = {
	positions: Array<{
		chainId: number;
		protocolName: string;
		assetAddress: string;
		assetSymbol: string;
		balanceUsd: number;
		balanceNative: number;
	}>;
	totalDeposited: string;
	totalYield: string;
	totalApy: string;
};

export type ComposerQuoteToolData = {
	action: ExecutionQuote['action'];
	transactionRequest: ExecutionQuote['transactionRequest'];
	estimate: ExecutionQuote['estimate'];
	tool: string;
	toolDetails?: ExecutionQuote['toolDetails'];
	includedSteps?: ExecutionQuote['includedSteps'];
	transactionId?: string;
};

export type EstimateYieldToolData = {
	principalAmount: string;
	apyPercent: string;
	days: number;
	dailyYield: string;
	estimatedYield: string;
	finalAmount: string;
};

type EarnToolCallbacks = {
	onStep?: (event: AgentStepEvent) => void;
	onResult?: (name: EarnToolName, result: AgentToolResult<unknown>) => void;
};

type EarnToolContext = {
	plan: PlannerOutput;
	userAddress: string;
	callbacks?: EarnToolCallbacks;
};

function emitToolStep(
	callbacks: EarnToolCallbacks | undefined,
	event: AgentStepEvent,
) {
	callbacks?.onStep?.(event);
}

function emitToolResult<T>(
	callbacks: EarnToolCallbacks | undefined,
	name: EarnToolName,
	result: AgentToolResult<T>,
) {
	callbacks?.onResult?.(name, result as AgentToolResult<unknown>);
}

function successResult<T>(data: T, summary: string): AgentToolResult<T> {
	return {
		success: true,
		data,
		summary,
	};
}

function buildListVaultsSummary(input: {
	result: SearchVaultsResult;
	chainId: number;
	token: string;
	count: number;
	transactionalCount: number;
	selectedVault: ListVaultsToolData['selectedVault'];
}) {
	return summarizeVaultSearchOutcome({
		chainName: getChainLabel(input.chainId),
		token: input.token,
		totalVaultCount: input.result.success ? input.result.vaults.length : 0,
		matchingTokenCount: input.count,
		transactionalCount: input.transactionalCount,
		selectedVault: input.selectedVault
			? {
					name: input.selectedVault.name,
					protocolName: input.selectedVault.protocol,
					apyTotal: Number(input.selectedVault.apy),
					underlyingSymbol: input.selectedVault.underlyingTokens[0] ?? input.token,
				}
			: null,
	});
}

function failureResult<T = never>(
	error: string,
	summary: string,
): AgentToolResult<T> {
	return {
		success: false,
		error,
		summary,
	};
}

function formatVault(vault: {
	address: string;
	name: string;
	protocolName: string;
	apyTotal: number;
	tvlUsd: number;
	underlyingSymbol: string;
	tags: string[];
	isTransactional: boolean;
}) {
	return {
		address: vault.address,
		name: vault.name,
		protocol: vault.protocolName,
		apy: vault.apyTotal.toFixed(2),
		tvl: vault.tvlUsd,
		underlyingTokens: [vault.underlyingSymbol],
		tags: vault.tags,
		openForDeposits: vault.isTransactional,
	};
}

export async function runListVaults(
	input: {
		chainId: number;
		token?: string;
		minApy?: number;
		limit?: number;
	},
	context: EarnToolContext,
): Promise<AgentToolResult<ListVaultsToolData>> {
	const stepKey = 'vault_search';
	const chainId = input.chainId || context.plan.targetChain;
	const token = (input.token || context.plan.asset || 'USDC').toUpperCase();
	const minApy = input.minApy ?? context.plan.minApy ?? undefined;
	const limit = Math.max(1, Math.min(input.limit ?? 3, 10));

	emitToolStep(
		context.callbacks,
		createAgentStepEvent(
			stepKey,
			'running',
			`Searching live ${token} vaults on ${getChainLabel(chainId)}.`,
		),
	);

	const result = await searchVaults({
		chainId,
		limit: Math.max(limit, 10),
	});

	if (!result.success) {
		const failure = failureResult<ListVaultsToolData>(
			result.error,
			`Live vault search failed on ${getChainLabel(chainId)}: ${result.error}`,
		);
		emitToolStep(
			context.callbacks,
			createAgentStepEvent(stepKey, 'failed', failure.summary),
		);
		emitToolResult(context.callbacks, 'listVaults', failure);
		return failure;
	}

	const filtered = result.vaults.filter((vault) =>
		token ? vault.underlyingSymbol === token : true,
	);
	const transactionalCount = filtered.filter((vault) => vault.isTransactional).length;
	const ranked = selectRecommendedVault({
		vaults: filtered,
		minApy: minApy ?? null,
		riskPreference: context.plan.riskPreference,
	});

	const data: ListVaultsToolData = {
		chainId,
		count: filtered.length,
		totalCount: result.vaults.length,
		transactionalCount,
		selectedVault: ranked.selectedVault ? formatVault(ranked.selectedVault) : null,
		alternatives: ranked.alternatives.map(formatVault),
		thresholdSatisfied: ranked.thresholdSatisfied,
	};

	const summary = buildListVaultsSummary({
		result,
		chainId,
		token,
		count: data.count,
		transactionalCount: data.transactionalCount,
		selectedVault: data.selectedVault,
	});

	const success = successResult(data, summary);
	emitToolStep(
		context.callbacks,
		createAgentStepEvent(stepKey, 'completed', summary),
	);
	emitToolResult(context.callbacks, 'listVaults', success);
	return success;
}

export async function runGetVaultDetail(
	input: { vaultAddress: string; chainId: number },
	context: EarnToolContext,
): Promise<AgentToolResult<VaultDetailToolData>> {
	const vault = await getVaultDetails({
		chainId: input.chainId,
		address: input.vaultAddress,
	});

	if (!vault) {
		const failure = failureResult<VaultDetailToolData>(
			'Vault detail not found in the current live vault dataset.',
			`Vault detail lookup failed for ${input.vaultAddress} on ${getChainLabel(input.chainId)}.`,
		);
		emitToolResult(context.callbacks, 'getVaultDetail', failure);
		return failure;
	}

	const success = successResult<VaultDetailToolData>(
		{
			vault: {
				address: vault.address,
				name: vault.name,
				protocol: vault.protocolName,
				apy: vault.apyTotal.toFixed(2),
				tvl: vault.tvlUsd,
				underlyingTokens: [vault.underlyingSymbol],
				assetAddress: vault.underlyingTokenAddress,
				descriptions: {},
				auditLinks: [],
			},
		},
		`Loaded vault details for ${vault.name} on ${vault.protocolName}.`,
	);
	emitToolResult(context.callbacks, 'getVaultDetail', success);
	return success;
}

export async function runGetPortfolio(
	input: { userAddress: string; chainId: number },
	context: EarnToolContext,
): Promise<AgentToolResult<PortfolioToolData>> {
	emitToolStep(
		context.callbacks,
		createAgentStepEvent(
			'portfolio_check',
			'running',
			`Checking wallet positions on ${getChainLabel(input.chainId)}.`,
		),
	);

	const portfolio = await getPortfolioPositions({ userAddress: input.userAddress });
	if (!portfolio.success) {
		const failure = failureResult<PortfolioToolData>(
			portfolio.error,
			`Portfolio lookup failed: ${portfolio.error}`,
		);
		emitToolStep(
			context.callbacks,
			createAgentStepEvent('portfolio_check', 'failed', failure.summary),
		);
		emitToolResult(context.callbacks, 'getPortfolio', failure);
		return failure;
	}

	const positions = portfolio.positions.filter(
		(position) => position.chainId === input.chainId,
	);
	const success = successResult<PortfolioToolData>(
		{
			positions,
			totalDeposited: '0',
			totalYield: '0',
			totalApy: '0',
		},
		positions.length > 0
			? `Found ${positions.length} matching wallet positions on ${getChainLabel(input.chainId)}.`
			: `No matching wallet positions found on ${getChainLabel(input.chainId)}.`,
	);
	emitToolStep(
		context.callbacks,
		createAgentStepEvent('portfolio_check', 'completed', success.summary),
	);
	emitToolResult(context.callbacks, 'getPortfolio', success);
	return success;
}

export async function runBuildComposerQuote(
	input: {
		fromChain: number;
		toChain: number;
		toToken: string;
		amount: number;
		fromAddress: string;
	},
	context: EarnToolContext,
): Promise<AgentToolResult<ComposerQuoteToolData>> {
	emitToolStep(
		context.callbacks,
		createAgentStepEvent(
			'quote_build',
			'running',
			`Building LI.FI quote for ${input.amount} USDC from ${getChainLabel(input.fromChain)} to ${getChainLabel(input.toChain)}.`,
		),
	);

	if (!Number.isFinite(input.amount) || input.amount <= 0) {
		const failure = failureResult<ComposerQuoteToolData>(
			'Quote amount must be a positive USDC amount.',
			'Quote amount must be a positive USDC amount.',
		);
		emitToolStep(
			context.callbacks,
			createAgentStepEvent('quote_build', 'failed', failure.summary),
		);
		emitToolResult(context.callbacks, 'buildComposerQuote', failure);
		return failure;
	}

	const quote = await buildDepositQuote({
		sourceChainId: input.fromChain,
		targetChainId: input.toChain,
		amount: input.amount,
		fromAddress: input.fromAddress,
		targetVaultAddress: input.toToken,
	});

	if (!quote.success) {
		const failure = failureResult<ComposerQuoteToolData>(
			quote.error,
			`Failed to build LI.FI quote: ${quote.error}`,
		);
		emitToolStep(
			context.callbacks,
			createAgentStepEvent('quote_build', 'failed', failure.summary),
		);
		emitToolResult(context.callbacks, 'buildComposerQuote', failure);
		return failure;
	}

	const quoteData = quote.quote;
	const feeUsd = quoteData.estimate?.feeCosts?.reduce((sum, fee) => {
		const value = Number(fee.amountUSD ?? 0);
		return Number.isFinite(value) ? sum + value : sum;
	}, 0);
	const success = successResult<ComposerQuoteToolData>(
		{
			action: quoteData.action,
			transactionRequest: quoteData.transactionRequest,
			estimate: quoteData.estimate,
			tool: quoteData.tool || 'composer',
			toolDetails: quoteData.toolDetails,
			includedSteps: quoteData.includedSteps,
			transactionId: quoteData.transactionId,
		},
		`Built LI.FI quote with ${(feeUsd ?? 0).toFixed(2)} USD estimated fees and ${quoteData.estimate?.executionDuration ?? 0}s estimated duration.`,
	);
	emitToolStep(
		context.callbacks,
		createAgentStepEvent('quote_build', 'completed', success.summary),
	);
	emitToolResult(context.callbacks, 'buildComposerQuote', success);
	return success;
}

export async function runEstimateYield(
	input: { principalAmount: number; apyPercent: number; days: number },
	context: EarnToolContext,
): Promise<AgentToolResult<EstimateYieldToolData>> {
	const dailyYieldPercent = input.apyPercent / 365;
	const dailyYield = input.principalAmount * (dailyYieldPercent / 100);
	const totalYield = dailyYield * input.days;
	const finalAmount = input.principalAmount + totalYield;

	const success = successResult<EstimateYieldToolData>(
		{
			principalAmount: input.principalAmount.toFixed(2),
			apyPercent: input.apyPercent.toFixed(2),
			days: input.days,
			dailyYield: dailyYield.toFixed(2),
			estimatedYield: totalYield.toFixed(2),
			finalAmount: finalAmount.toFixed(2),
		},
		`Estimated ${totalYield.toFixed(2)} USDC yield over ${input.days} days at ${input.apyPercent.toFixed(2)}% APY.`,
	);
	emitToolResult(context.callbacks, 'estimateYield', success);
	return success;
}

export function createEarnAgentTools(context: EarnToolContext) {
	return {
		listVaults: tool({
			description:
				'List live LI.FI earn vaults on a target chain, ranked for the current Earn recommendation flow.',
			parameters: z.object({
				chainId: z
					.number()
					.describe(
						'The target chain ID for the LI.FI Earn search, for example 8453 for Base or 137 for Polygon.',
					),
				token: z.string().optional().describe('Underlying token symbol, e.g. USDC.'),
				minApy: z.number().optional().describe('Minimum target APY threshold.'),
				limit: z.number().optional().describe('Maximum number of ranked results.'),
			}),
			execute: async (args) => runListVaults(args, context),
		}),
		getVaultDetail: tool({
			description: 'Get live details for a specific LI.FI earn vault.',
			parameters: z.object({
				vaultAddress: z.string().describe('The vault contract address.'),
				chainId: z.number().describe('The chain ID where the vault is deployed.'),
			}),
			execute: async (args) => runGetVaultDetail(args, context),
		}),
		getPortfolio: tool({
			description:
				"Get the user's LI.FI earn portfolio positions for the requested chain.",
			parameters: z.object({
				userAddress: z.string().describe("The user's wallet address."),
				chainId: z.number().describe('The chain ID to filter to.'),
			}),
			execute: async (args) => runGetPortfolio(args, context),
		}),
		estimateYield: tool({
			description: 'Estimate yield for a deposit over a number of days.',
			parameters: z.object({
				principalAmount: z.number().describe('Principal amount in USDC.'),
				apyPercent: z.number().describe('Annual Percentage Yield, e.g. 4.2.'),
				days: z.number().describe('Number of days to calculate yield for.'),
			}),
			execute: async (args) => runEstimateYield(args, context),
		}),
		buildComposerQuote: tool({
			description:
				'Build a live LI.FI Composer quote for depositing USDC into the selected vault.',
			parameters: z.object({
				fromChain: z.number().describe('Source chain ID.'),
				toChain: z.number().describe('Destination chain ID.'),
				toToken: z.string().describe('Vault address to deposit into.'),
				amount: z.number().describe('Amount in USDC units, e.g. 500.'),
				fromAddress: z.string().describe('User wallet address.'),
			}),
			execute: async (args) => runBuildComposerQuote(args, context),
		}),
	};
}

export const SAFE_EARN_TOOL_NAMES: EarnToolName[] = [
	'listVaults',
	'getVaultDetail',
	'getPortfolio',
	'estimateYield',
	'buildComposerQuote',
];
