import { streamText } from 'ai';
import { getAgentConfig } from '@/lib/agentConfig';
import { getModelFromConfig } from '@/lib/agentClient';
import { formatSupportedBusinessChainsWithIds } from '@/lib/businessChains';
import { buildPlannerPrompt } from '@/lib/plannerPrompt';
import {
	buildPlannerFallback,
	detectIntentFromMessage,
	extractPlannerPayload,
	mergeIntentPlanFromUserText,
	type PlannerOutput,
} from '@/lib/plannerRuntime';
import {
	buildIntentExecutionPreview,
	requestMainnetIntentFlight,
	type IntentFlightRecord,
} from '@/lib/lifiIntents';
import { earningAgentStream } from './earning';
import type { ExecutionPreview } from '@/lib/executionRuntime';
import type { NormalizedVaultCandidate } from '@/lib/lifiRuntime';
import type { AgentStepEvent } from '@/lib/agentSteps';
import {
	buildWalletContextResponse,
	isWalletContextQuestion,
} from '@/lib/walletContext';
import type { AgentChatMode } from '@/lib/agentRuntime';

type MainAgentInput = {
	userMessage: string;
	userAddress: string;
	walletChainId: number;
	mode?: AgentChatMode;
	messages: Array<{ role: 'user' | 'ai'; content: string }>;
};

export type MainAgentStreamChunk =
	| { type: 'thinking'; content: string }
	| { type: 'response'; content: string }
	| { type: 'error'; content: string }
	| { type: 'plan'; plan: PlannerOutput }
	| { type: 'intent_flight_record'; record: IntentFlightRecord }
	| AgentStepEvent
	| {
			type: 'execution_preview';
			preview: ExecutionPreview;
			selectedVault: NormalizedVaultCandidate | null;
			alternatives: NormalizedVaultCandidate[];
	  }
	| {
			type: 'done';
			intent: 'intent' | 'bridge' | 'monitor' | 'unknown';
			chainId: number;
	  };

async function* streamPlannerText(
	input: MainAgentInput,
): AsyncGenerator<string, string> {
	const fallback = buildPlannerFallback({
		message: input.userMessage,
		walletChainId: input.walletChainId,
	});

	try {
		const config = getAgentConfig('main');
		const model = getModelFromConfig(config);
		const result = streamText({
			model,
			temperature: 0,
			maxTokens: 220,
			system: [
				'You are the planner for an Intents-first LI.FI education application.',
				'Return JSON only.',
				'Supported intents: intent.transfer, bridge, monitor, unknown.',
				'Supported asset in this version: USDC.',
				`Supported chains in this version: ${formatSupportedBusinessChainsWithIds()}.`,
				'Default to intent.transfer for USDC requests, including requests that mention vaults, earn, APY, or deposits.',
				'This product is an Intents-first education demo. Do not route initial user requests into Earn tools.',
				'Use execute mode only when the user clearly asks to proceed now.',
				'Schema:',
				'{"intent":"intent.transfer|bridge|monitor|unknown","asset":"USDC","amount":500,"sourceChain":8453,"targetChain":42161,"minApy":null,"riskPreference":"low|medium|high","objective":"best_received|fastest|lowest_cost","needsConfirmation":true,"mode":"recommend|execute"}',
			].join('\n'),
			prompt: buildPlannerPrompt(input),
		});

		let text = '';
		for await (const delta of result.textStream) {
			text += delta;
			yield delta;
		}

		return text;
	} catch {
		return JSON.stringify(fallback);
	}
}

function unsupportedIntentMessage(intent: 'bridge' | 'monitor'): string {
	if (intent === 'bridge') {
		return [
			'## Bridge is outside this MVP',
			'IntentLens currently focuses on LI.FI Intents education for Base USDC -> Arbitrum USDC.',
			'Try: Move 10 USDC from Base to Arbitrum with best received amount',
		].join('\n\n');
	}

	return [
		'## Monitor is outside this MVP',
		'IntentLens currently focuses on LI.FI Intents education for Base USDC -> Arbitrum USDC.',
		'Try: Send 5 USDC from Base to Arbitrum using LI.FI Intents',
	].join('\n\n');
}

function unknownIntentMessage(): string {
	return [
		'IntentLens is an Intents-first LI.FI builder education demo.',
		'Current MVP path: Base USDC -> Arbitrum USDC.',
		'Try: Move 10 USDC from Base to Arbitrum with best received amount',
	].join('\n\n');
}

function buildUnknownIntentPrompt(input: MainAgentInput): string {
	const history = input.messages
		.slice(-6)
		.map((message) => `${message.role}: ${message.content}`)
		.join('\n');

	return [
		`User wallet: ${input.userAddress}`,
		`Wallet chain: ${input.walletChainId}`,
		`Current message: ${input.userMessage}`,
		history ? `Recent messages:\n${history}` : '',
	]
		.filter(Boolean)
		.join('\n\n');
}

async function* unknownIntentMessageFromModel(
	input: MainAgentInput,
): AsyncGenerator<string> {
	try {
		const model = getModelFromConfig(getAgentConfig('main'));
		const result = streamText({
			model,
			temperature: 0,
			maxTokens: 800,
			system: [
				'You are IntentLens, the LI.FI Intents education agent for a USDC-focused DeFi assistant.',
				'You can call tools to gather facts when needed, but do not fabricate tool output.',
				'The current product scope is LI.FI Intents education.',
				`Supported chains: ${formatSupportedBusinessChainsWithIds()}.`,
				'Supported asset in this demo: USDC.',
				'If the request is out of scope, politely explain the Base USDC -> Arbitrum USDC MVP and provide 1-2 valid Intents examples.',
			].join('\n'),
			prompt: buildUnknownIntentPrompt(input),
		});

		for await (const delta of result.textStream) {
			yield delta;
		}
	} catch {
		return;
	}
}

async function* runIntentFlight(
	input: MainAgentInput,
	plan: PlannerOutput,
): AsyncGenerator<MainAgentStreamChunk> {
	const intentPlan =
		plan.intent === 'intent.transfer'
			? plan
			: buildPlannerFallback({
					message: input.userMessage,
					walletChainId: input.walletChainId,
				});

	yield { type: 'plan', plan: intentPlan };
	yield {
		type: 'thinking',
		content: 'Requesting a mainnet LI.FI Intents solver quote...\n',
	};

	const record = await requestMainnetIntentFlight({
		asset: 'USDC',
		amount: intentPlan.amount,
		sourceChain: intentPlan.sourceChain,
		targetChain: intentPlan.targetChain,
		objective: intentPlan.objective,
		userAddress: input.userAddress,
	});

	yield { type: 'intent_flight_record', record };
	const executionPreview = buildIntentExecutionPreview({
		goal: record.goal,
		quoteResult: record.quoteResult,
	});
	if (executionPreview) {
		yield {
			type: 'execution_preview',
			preview: executionPreview,
			selectedVault: null,
			alternatives: [],
		};
	}
	yield {
		type: 'response',
		content:
			record.status === 'quote_ready' && executionPreview
				? [
						'## IntentLens Flight Recorder',
						record.educationSummary,
						'The wallet execution preview below can open the LI.FI Intents escrow order on Base. It still requires your manual wallet confirmation, and settlement is completed by solvers after the source-chain intent is opened.',
					].join('\n\n')
				: record.status === 'quote_ready'
				? [
						'## IntentLens Flight Recorder',
						record.educationSummary,
						'The record below is a mainnet LI.FI Intents quote/order preview. No funds move unless you manually confirm a wallet signature.',
					].join('\n\n')
				: [
						'## IntentLens Flight Recorder',
						record.educationSummary,
						`Mainnet LI.FI Intents response: ${record.quoteResult.success ? 'quote ready' : record.quoteResult.error}`,
					].join('\n\n'),
	};
	yield {
		type: 'done',
		intent: 'intent',
		chainId: intentPlan.targetChain,
	};
}

export function resolveEffectiveIntentForMode(input: {
	mode?: AgentChatMode;
	planIntent: PlannerOutput['intent'];
	detectedIntent: PlannerOutput['intent'];
}): PlannerOutput['intent'] {
	if (input.mode === 'classic_route') {
		return 'earn.deposit';
	}

	return input.planIntent === 'unknown' && input.detectedIntent !== 'unknown'
		? input.detectedIntent
		: input.planIntent;
}

export async function* mainAgentStream(
	input: MainAgentInput,
): AsyncGenerator<MainAgentStreamChunk> {
	if (isWalletContextQuestion(input.userMessage)) {
		yield {
			type: 'response',
			content: buildWalletContextResponse({
				userAddress: input.userAddress,
				walletChainId: input.walletChainId,
			}),
		};
		yield {
			type: 'done',
			intent: 'unknown',
			chainId: input.walletChainId,
		};
		return;
	}

	yield { type: 'thinking', content: 'Planning request, please wait...\n' };

	let plannerText = '';
	const plannerStream = streamPlannerText(input);
	while (true) {
		const next = await plannerStream.next();
		if (next.done) {
			plannerText = next.value;
			break;
		}

		yield { type: 'thinking', content: next.value };
	}

	const plannerPlan = extractPlannerPayload(plannerText, input.walletChainId);
	const plan = mergeIntentPlanFromUserText({
		userMessage: input.userMessage,
		walletChainId: input.walletChainId,
		plannerPlan,
	});
	const detected = detectIntentFromMessage(input.userMessage);
	const effectiveIntent = resolveEffectiveIntentForMode({
		mode: input.mode,
		planIntent: plan.intent,
		detectedIntent: detected.intent,
	});

	if (effectiveIntent === 'bridge' || effectiveIntent === 'monitor') {
		yield {
			type: 'response',
			content: unsupportedIntentMessage(effectiveIntent),
		};
		yield {
			type: 'done',
			intent: effectiveIntent,
			chainId: plan.targetChain,
		};
		return;
	}

	if (effectiveIntent === 'intent.transfer') {
		yield* runIntentFlight(input, plan);
		return;
	}

	if (effectiveIntent === 'earn.deposit') {
		yield* earningAgentStream({
			userMessage: input.userMessage,
			userAddress: input.userAddress,
			plan,
			messages: input.messages,
		});
		return;
	}

	let emittedUnknownResponse = false;
	for await (const delta of unknownIntentMessageFromModel(input)) {
		emittedUnknownResponse = true;
		yield { type: 'response', content: delta };
	}

	if (!emittedUnknownResponse) {
		yield { type: 'response', content: unknownIntentMessage() };
	}
	yield {
		type: 'done',
		intent: 'unknown',
		chainId: plan.targetChain,
	};
}
