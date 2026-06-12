import { streamText } from 'ai';
import { getAgentConfig } from '@/lib/agentConfig';
import { getModelFromConfig } from '@/lib/agentClient';
import { createAgentStepEvent, type AgentStepEvent } from '@/lib/agentSteps';
import {
	formatSupportedBusinessChainsWithIds,
	formatSupportedCrossChainEarnTargetsWithIds,
	getChainLabel,
} from '@/lib/businessChains';
import { buildExecutionPreview, type ExecutionPreview } from '@/lib/executionRuntime';
import {
	buildVaultDisplayName,
	type NormalizedVaultCandidate,
	type NormalizedPortfolioPosition,
} from '@/lib/lifiRuntime';
import type { PlannerOutput } from '@/lib/plannerRuntime';
import { buildDepositQuote, renderEarnRecommendation } from '@/lib/lifiDomain';
import {
	createEarnAgentTools,
	runGetPortfolio,
	runListVaults,
	type AgentToolResult,
	type ComposerQuoteToolData,
	type ListVaultsToolData,
	type PortfolioToolData,
} from '../tools';

export type EarningAgentInput = {
	userMessage: string;
	userAddress: string;
	plan: PlannerOutput;
	messages: Array<{ role: 'user' | 'ai'; content: string }>;
};

export type EarningStreamChunk =
	| { type: 'thinking'; content: string }
	| { type: 'response'; content: string }
	| { type: 'error'; content: string }
	| { type: 'plan'; plan: PlannerOutput }
	| AgentStepEvent
	| {
			type: 'execution_preview';
			preview: ExecutionPreview;
			selectedVault: NormalizedVaultCandidate | null;
			alternatives: NormalizedVaultCandidate[];
	  };

type EarnRuntimeState = {
	listVaults: AgentToolResult<ListVaultsToolData> | null;
	portfolio: AgentToolResult<PortfolioToolData> | null;
	quote: AgentToolResult<ComposerQuoteToolData> | null;
};

function chainName(chainId: number): string {
	return getChainLabel(chainId);
}

function buildEarnPrompt(input: EarningAgentInput): string {
	const history = input.messages
		.slice(-6)
		.map((message) => `${message.role}: ${message.content}`)
		.join('\n');

	return [
		`User wallet: ${input.userAddress}`,
		`Current request: ${input.userMessage}`,
		`Structured plan: ${JSON.stringify(input.plan)}`,
		history ? `Recent messages:\n${history}` : '',
	]
		.filter(Boolean)
		.join('\n\n');
}

function buildEarnSystemPrompt(): string {
	return [
		'You are the LI.FI AI Earn agent for a USDC-focused DeFi assistant.',
		'You must call tools to gather facts before recommending anything.',
		`Only support USDC on ${formatSupportedBusinessChainsWithIds()}.`,
		'Always call listVaults before making a recommendation.',
		'Call getPortfolio only if wallet context helps explain the recommendation.',
		'Call getVaultDetail only when you need extra facts about a candidate vault.',
		'If the user provided an amount, call buildComposerQuote after you know the selected vault address.',
		'For cross-chain Earn requests, search vaults on the target chain first and only then build the quote from the source chain into that target vault.',
		`Only support cross-chain Earn into ${formatSupportedCrossChainEarnTargetsWithIds()}. Requests targeting other chains across chains must be treated as unsupported.`,
		'Never describe a cross-chain route as fully completed on the destination chain. At most, the app confirms the source-chain route transaction.',
		'When a LI.FI quote fails, report the exact tool error string as the primary fact.',
		'Do not speculate about minimum amounts, route thresholds, or unsupported paths unless a tool result explicitly states that cause.',
		'You may call estimateYield to explain projected returns.',
		'Never invent vault names, APY, TVL, fee, or quote data.',
		'Never claim a transaction has executed. Wallet confirmation and transaction submission happen outside of the model.',
		'Write a concise recommendation that references tool results.',
	].join('\n');
}

function toNormalizedVault(
	vault: ListVaultsToolData['selectedVault'],
	chainId: number,
): NormalizedVaultCandidate | null {
	if (!vault) {
		return null;
	}

	return {
		address: vault.address,
		chainId,
		name: vault.name,
		protocolName: vault.protocol,
		underlyingSymbol: vault.underlyingTokens[0] ?? 'USDC',
		underlyingTokenAddress: '',
		apyTotal: Number(vault.apy),
		tvlUsd: vault.tvl,
		tags: vault.tags,
		isTransactional: vault.openForDeposits,
		isRedeemable: false,
		dataSource: 'live',
	};
}

function toNormalizedAlternatives(
	alternatives: ListVaultsToolData['alternatives'],
	chainId: number,
): NormalizedVaultCandidate[] {
	return alternatives.map((vault) => ({
		address: vault.address,
		chainId,
		name: vault.name,
		protocolName: vault.protocol,
		underlyingSymbol: vault.underlyingTokens[0] ?? 'USDC',
		underlyingTokenAddress: '',
		apyTotal: Number(vault.apy),
		tvlUsd: vault.tvl,
		tags: vault.tags,
		isTransactional: vault.openForDeposits,
		isRedeemable: false,
		dataSource: 'live',
	}));
}

function toPortfolioPositions(
	result: AgentToolResult<PortfolioToolData> | null,
): NormalizedPortfolioPosition[] {
	return result?.success ? result.data.positions : [];
}

function toExecutionQuote(
	result: AgentToolResult<ComposerQuoteToolData> | null,
) {
	if (!result?.success) {
		return null;
	}

	return {
		action: result.data.action,
		estimate: result.data.estimate,
		tool: result.data.tool,
		toolDetails: result.data.toolDetails,
		includedSteps: result.data.includedSteps,
		transactionRequest: result.data.transactionRequest,
		transactionId: result.data.transactionId,
	};
}

function buildQuoteSummary(
	quote: NonNullable<ReturnType<typeof toExecutionQuote>>,
): string {
	const feeUsd = quote.estimate?.feeCosts?.reduce((sum, fee) => {
		const value = Number(fee.amountUSD ?? 0);
		return Number.isFinite(value) ? sum + value : sum;
	}, 0);

	return `Built LI.FI quote with ${(feeUsd ?? 0).toFixed(2)} USD estimated fees and ${quote.estimate?.executionDuration ?? 0}s estimated duration.`;
}

async function resolveExecutableQuote(input: {
	plan: PlannerOutput;
	userAddress: string;
	selectedVault: NormalizedVaultCandidate;
	alternatives: NormalizedVaultCandidate[];
	currentQuote: AgentToolResult<ComposerQuoteToolData> | null;
}) {
	if (input.plan.amount == null || input.currentQuote?.success) {
		return {
			selectedVault: input.selectedVault,
			alternatives: input.alternatives,
			quote: input.currentQuote,
			attemptedCandidates: 0,
			recovered: false,
		};
	}

	const candidates = [input.selectedVault, ...input.alternatives];

	// Fire all quote requests in parallel
	const results = await Promise.allSettled(
		candidates.map(async (candidate) => {
			const quoteResult = await buildDepositQuote({
				sourceChainId: input.plan.sourceChain,
				targetChainId: input.plan.targetChain,
				amount: input.plan.amount!,
				fromAddress: input.userAddress,
				targetVaultAddress: candidate.address,
			});
			return { candidate, quoteResult };
		}),
	);

	// Iterate in original order to preserve candidate priority
	for (const settled of results) {
		if (settled.status !== 'fulfilled') continue;
		const { candidate, quoteResult } = settled.value;
		if (!quoteResult.success) continue;

		const quote = {
			action: quoteResult.quote.action,
			estimate: quoteResult.quote.estimate,
			tool: quoteResult.quote.tool || 'composer',
			toolDetails: quoteResult.quote.toolDetails,
			includedSteps: quoteResult.quote.includedSteps,
			transactionRequest: quoteResult.quote.transactionRequest,
			transactionId: quoteResult.quote.transactionId,
		};

		return {
			selectedVault: candidate,
			alternatives: candidates.filter((v) => v.address !== candidate.address),
			quote: {
				success: true as const,
				data: quote,
				summary: buildQuoteSummary(quote),
			},
			attemptedCandidates: candidates.length,
			recovered: candidate.address !== input.selectedVault.address,
		};
	}

	// All failed — extract last error
	const lastError = results
		.filter(
			(r): r is PromiseFulfilledResult<{ candidate: NormalizedVaultCandidate; quoteResult: { success: false; error: string } }> =>
				r.status === 'fulfilled' && !r.value.quoteResult.success,
		)
		.pop()?.value.quoteResult.error ?? 'Live LI.FI quote data is unavailable right now.';

	return {
		selectedVault: input.selectedVault,
		alternatives: input.alternatives,
		quote: {
			success: false as const,
			error: lastError,
			summary: `Failed to build LI.FI quote: ${lastError}`,
		},
		attemptedCandidates: candidates.length,
		recovered: false,
	};
}

function buildFallbackResponse(input: {
	plan: PlannerOutput;
	listVaults: AgentToolResult<ListVaultsToolData> | null;
}): string {
	if (!input.listVaults) {
		return 'I could not fetch LI.FI Earn vault data, so I cannot make a safe recommendation yet.';
	}

	if (!input.listVaults.success) {
		return [
			'Source: live',
			input.listVaults.summary,
			'Execution preview is unavailable until vault discovery succeeds.',
		].join('\n\n');
	}

	if (!input.listVaults.data.selectedVault) {
		return [
			'Source: live',
			input.listVaults.summary,
			'Execution preview is unavailable because there is no vault to target.',
		].join('\n\n');
	}

	return input.listVaults.summary;
}


export async function* earningAgentStream(
	input: EarningAgentInput,
): AsyncGenerator<EarningStreamChunk> {
	yield { type: 'plan', plan: input.plan };
	yield {
		type: 'step',
		key: 'planning',
		title: 'Planning',
		status: 'completed',
		summary: `Earn plan ready for ${chainName(input.plan.targetChain)}.`,
	};
	yield { type: 'thinking', content: 'Calling safe LI.FI Earn tools...\n' };

	const runtimeState: EarnRuntimeState = {
		listVaults: null,
		portfolio: null,
		quote: null,
	};
	const stepLog: AgentStepEvent[] = [];

	const tools = createEarnAgentTools({
		plan: input.plan,
		userAddress: input.userAddress,
		callbacks: {
			onStep: (event) => {
				stepLog.push(event);
			},
			onResult: (name, result) => {
				if (name === 'listVaults') {
					runtimeState.listVaults = result as AgentToolResult<ListVaultsToolData>;
				} else if (name === 'getPortfolio') {
					runtimeState.portfolio = result as AgentToolResult<PortfolioToolData>;
				} else if (name === 'buildComposerQuote') {
					runtimeState.quote = result as AgentToolResult<ComposerQuoteToolData>;
				}
			},
		},
	});

	let modelText = '';

	try {
		const model = getModelFromConfig(getAgentConfig('earning'));
		const result = streamText({
			model,
			temperature: 0,
			maxTokens: 900,
			maxSteps: 6,
			system: buildEarnSystemPrompt(),
			prompt: buildEarnPrompt(input),
			tools,
			experimental_activeTools: [
				'listVaults',
				'getVaultDetail',
				'getPortfolio',
				'estimateYield',
				'buildComposerQuote',
			],
		});

		for await (const part of result.fullStream) {
			switch (part.type) {
				case 'text-delta':
					modelText += part.textDelta;
					yield { type: 'response' as const, content: part.textDelta };
					break;
				case 'reasoning':
					yield { type: 'thinking' as const, content: part.textDelta };
					break;
				case 'tool-call':
					for (const step of stepLog.splice(0)) {
						yield step;
					}
					break;
				case 'tool-result':
					for (const step of stepLog.splice(0)) {
						yield step;
					}
					break;
				case 'error':
					yield {
						type: 'error' as const,
						content:
							part.error instanceof Error
								? part.error.message
								: 'Tool-driven earn planning failed.',
					};
					return;
				default:
					break;
			}
		}
	} catch (error) {
		yield {
			type: 'error' as const,
			content:
				error instanceof Error ? error.message : 'Tool-driven earn planning failed.',
		};
		return;
	}

	// Drain any remaining step events
	for (const step of stepLog.splice(0)) {
		yield step;
	}

	// Parallelize fallback calls for vault search and portfolio
	const [fallbackVaults, fallbackPortfolio] = await Promise.all([
		runtimeState.listVaults
			? Promise.resolve(runtimeState.listVaults)
			: runListVaults(
					{
						chainId: input.plan.targetChain,
						token: input.plan.asset,
						minApy: input.plan.minApy ?? undefined,
						limit: 3,
					},
					{ plan: input.plan, userAddress: input.userAddress },
				),
		runtimeState.portfolio
			? Promise.resolve(runtimeState.portfolio)
			: runGetPortfolio(
					{
						userAddress: input.userAddress,
						chainId: input.plan.targetChain,
					},
					{ plan: input.plan, userAddress: input.userAddress },
				),
	]);
	runtimeState.listVaults = fallbackVaults;
	runtimeState.portfolio = fallbackPortfolio;

	// Drain step events from fallback calls
	for (const step of stepLog.splice(0)) {
		yield step;
	}

	const listVaults = runtimeState.listVaults;
	let selectedVault =
		listVaults?.success && listVaults.data.selectedVault
			? toNormalizedVault(listVaults.data.selectedVault, input.plan.targetChain)
			: null;
	let alternatives =
		listVaults?.success && listVaults.data.alternatives.length > 0
			? toNormalizedAlternatives(
					listVaults.data.alternatives,
					input.plan.targetChain,
				)
			: [];

	if (!selectedVault || !listVaults?.success) {
		yield {
			type: 'response',
			content: buildFallbackResponse({
				plan: input.plan,
				listVaults,
			}),
		};
		return;
	}

	const quoteResolution = await resolveExecutableQuote({
		plan: input.plan,
		userAddress: input.userAddress,
		selectedVault,
		alternatives,
		currentQuote: runtimeState.quote,
	});
	selectedVault = quoteResolution.selectedVault;
	alternatives = quoteResolution.alternatives;
	runtimeState.quote = quoteResolution.quote;

	if (input.plan.amount != null && quoteResolution.attemptedCandidates > 0) {
		yield createAgentStepEvent(
			'quote_build',
			runtimeState.quote?.success ? 'completed' : 'failed',
			runtimeState.quote?.success
				? quoteResolution.recovered
					? `Built a cross-chain compatible LI.FI quote for ${buildVaultDisplayName(selectedVault)} after checking multiple vault options.`
					: runtimeState.quote.summary
				: runtimeState.quote?.summary ??
					'LI.FI quote could not be built for the current vault options.',
		);
	}

	const executionPreview = buildExecutionPreview({
		plan: input.plan,
		selectedVault: {
			address: selectedVault.address,
			name: selectedVault.name,
			displayName: buildVaultDisplayName(selectedVault),
			dataSource: selectedVault.dataSource,
		},
		quote: toExecutionQuote(runtimeState.quote),
		quoteFailureReason:
			runtimeState.quote?.success === false ? runtimeState.quote.error : undefined,
	});

	yield {
		type: 'step',
		key: 'recommendation_ready',
		title: 'Recommendation Ready',
		status: 'completed',
		summary: runtimeState.quote?.success
			? 'Recommendation, quote, and execution preview are ready.'
			: 'Recommendation is ready. Quote is unavailable, so execution remains blocked.',
	};

	yield {
		type: 'execution_preview',
		preview: executionPreview,
		selectedVault,
		alternatives,
	};

	const deterministicText = renderEarnRecommendation({
		chainName: chainName(input.plan.targetChain),
		dataSource: 'live',
		fallbackReason:
			runtimeState.quote && !runtimeState.quote.success
				? runtimeState.quote.error
				: undefined,
		selectedVault,
		alternatives,
		portfolioPositions: toPortfolioPositions(runtimeState.portfolio),
		plan: input.plan,
		executionPreview,
		thresholdSatisfied: listVaults.data.thresholdSatisfied,
		selectionNote:
			quoteResolution.recovered
				? 'Higher-ranked Polygon vault candidates were skipped because they did not produce an executable Base -> Polygon quote for this request.'
				: undefined,
	});

	yield {
		type: 'response',
		content: modelText.trim()
			? `\n\n${deterministicText}`
			: deterministicText,
	};
}
