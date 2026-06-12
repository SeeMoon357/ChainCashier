import {
	getPlannerAliasesByChain,
	isSupportedEarnChain,
	isSupportedEarnTargetChain,
	SUPPORTED_EARN_CHAIN_IDS,
	type BusinessChainId,
	type EarnTargetChainId,
} from './businessChains';

export const SUPPORTED_WALLET_CHAIN_IDS = SUPPORTED_EARN_CHAIN_IDS;
export const DEFAULT_WALLET_CHAIN_ID = 8453;

export type SupportedWalletChainId =
	(typeof SUPPORTED_WALLET_CHAIN_IDS)[number];
export type PlannerIntent =
	| 'earn.deposit'
	| 'intent.transfer'
	| 'bridge'
	| 'monitor'
	| 'unknown';
export type PlannerMode = 'recommend' | 'execute';
export type RiskPreference = 'low' | 'medium' | 'high';
export type PlannerObjective = 'best_received' | 'fastest' | 'lowest_cost';

export type PlannerOutput = {
	intent: PlannerIntent;
	asset: 'USDC';
	amount: number | null;
	sourceChain: SupportedWalletChainId;
	targetChain: EarnTargetChainId;
	minApy: number | null;
	riskPreference: RiskPreference;
	objective: PlannerObjective;
	needsConfirmation: boolean;
	mode: PlannerMode;
};

function normalizeAmount(value: unknown): number | null {
	const amount = Number(value);
	if (!Number.isFinite(amount) || amount <= 0) {
		return null;
	}

	return amount;
}

function parseAmount(message: string): number | null {
	const match = message.match(/\b(\d[\d,]*\.?\d*)\s*usdc\b/i);
	if (!match) {
		return null;
	}

	return normalizeAmount(match[1].replace(/,/g, ''));
}

function parseMinApy(message: string): number | null {
	const match = message.match(/(\d+(?:\.\d+)?)\s*%\s*apy/i);
	if (match) {
		const value = Number(match[1]);
		return Number.isFinite(value) ? value : null;
	}

	const thresholdMatch = message.match(/above\s*(\d+(?:\.\d+)?)\s*%/i);
	if (thresholdMatch) {
		const value = Number(thresholdMatch[1]);
		return Number.isFinite(value) ? value : null;
	}

	return null;
}

function includesAny(message: string, patterns: string[]): boolean {
	return patterns.some((pattern) => message.includes(pattern));
}

function parseChainByName(message: string): EarnTargetChainId | null {
	const lowered = message.toLowerCase();
	for (const { chainId, aliases } of getPlannerAliasesByChain()) {
		if (
			isSupportedEarnTargetChain(chainId) &&
			aliases.some((alias) => lowered.includes(alias))
		) {
			return chainId;
		}
	}

	return null;
}

function parsePrefixedChain(
	message: string,
	prefixes: string[],
	filter: (chainId: BusinessChainId) => boolean,
): BusinessChainId | null {
	const lowered = message.toLowerCase();

	for (const { chainId, aliases } of getPlannerAliasesByChain()) {
		if (!filter(chainId)) {
			continue;
		}

		for (const alias of aliases) {
			if (prefixes.some((prefix) => lowered.includes(`${prefix} ${alias}`))) {
				return chainId;
			}
		}
	}

	return null;
}

function parseSourceChain(message: string): SupportedWalletChainId | null {
	const chainId = parsePrefixedChain(message, ['from'], isSupportedEarnChain);
	return chainId != null && isSupportedEarnChain(chainId) ? chainId : null;
}

function parseTargetChain(message: string): EarnTargetChainId | null {
	return parsePrefixedChain(
		message,
		['on', 'into', 'to'],
		isSupportedEarnTargetChain,
	);
}

export function resolveWalletChainId(
	chainId: number | null | undefined,
): SupportedWalletChainId {
	if (typeof chainId === 'number' && isSupportedEarnChain(chainId)) {
		return chainId;
	}

	return DEFAULT_WALLET_CHAIN_ID;
}

export function detectIntentFromMessage(message: string): {
	intent: PlannerIntent;
	actionMode: PlannerMode;
} {
	const lowered = message.trim().toLowerCase();
	const actionMode = includesAny(lowered, [
		'go ahead',
		'execute',
		'run it',
		'deposit now',
		'confirm',
	])
		? 'execute'
		: 'recommend';

	if (
		includesAny(lowered, [
			'classic route',
			'old route',
			'legacy earn',
			'use legacy',
			'use classic',
		])
	) {
		return { intent: 'earn.deposit', actionMode };
	}

	if (includesAny(lowered, ['monitor', 'positions', 'portfolio', 'balance'])) {
		return { intent: 'monitor', actionMode };
	}

	return { intent: 'intent.transfer', actionMode };
}

function parseObjective(message: string): PlannerObjective {
	if (includesAny(message, ['fastest', 'quickest', 'speed'])) {
		return 'fastest';
	}

	if (includesAny(message, ['lowest cost', 'cheapest', 'lowest fee'])) {
		return 'lowest_cost';
	}

	return 'best_received';
}

export function buildPlannerFallback(input: {
	message: string;
	walletChainId: number | null | undefined;
}): PlannerOutput {
	const normalizedWalletChain = resolveWalletChainId(input.walletChainId);
	const lowered = input.message.trim().toLowerCase();
	const sourceChain = parseSourceChain(lowered) ?? normalizedWalletChain;
	const targetChain =
		parseTargetChain(lowered) ??
		parseChainByName(lowered) ??
		normalizedWalletChain;
	const { intent, actionMode } = detectIntentFromMessage(lowered);

	let riskPreference: RiskPreference = 'medium';
	if (includesAny(lowered, ['safest', 'safer', 'low risk'])) {
		riskPreference = 'low';
	} else if (includesAny(lowered, ['highest yield', 'aggressive', 'max apy'])) {
		riskPreference = 'high';
	}

	return {
		intent,
		asset: 'USDC',
		amount: parseAmount(lowered),
		sourceChain,
		targetChain,
		minApy: parseMinApy(lowered),
		riskPreference,
		objective: parseObjective(lowered),
		needsConfirmation: true,
		mode: actionMode,
	};
}

export function extractPlannerPayload(
	text: string,
	walletChainId: number | null | undefined,
): PlannerOutput {
	const fallback = buildPlannerFallback({
		message: text,
		walletChainId,
	});

	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(jsonMatch[0]) as Partial<PlannerOutput>;
		const sourceChain = resolveWalletChainId(parsed.sourceChain ?? walletChainId);
		const targetChain =
			typeof parsed.targetChain === 'number' &&
			isSupportedEarnTargetChain(parsed.targetChain)
				? parsed.targetChain
				: sourceChain;
		const mode: PlannerMode =
			parsed.mode === 'execute' ? 'execute' : 'recommend';
		const riskPreference: RiskPreference =
			parsed.riskPreference === 'low' ||
			parsed.riskPreference === 'medium' ||
			parsed.riskPreference === 'high'
				? parsed.riskPreference
				: 'medium';
		const intent: PlannerIntent =
			parsed.intent === 'intent.transfer' ||
			parsed.intent === 'bridge' ||
			parsed.intent === 'monitor'
				? parsed.intent
				: fallback.intent;
		const objective: PlannerObjective =
			parsed.objective === 'fastest' || parsed.objective === 'lowest_cost'
				? parsed.objective
				: 'best_received';

		return {
			intent,
			asset: 'USDC',
			amount: normalizeAmount(parsed.amount),
			sourceChain,
			targetChain,
			minApy:
				typeof parsed.minApy === 'number' && Number.isFinite(parsed.minApy)
					? parsed.minApy
					: null,
			riskPreference,
			objective,
			needsConfirmation:
				typeof parsed.needsConfirmation === 'boolean'
					? parsed.needsConfirmation
					: true,
			mode,
		};
	} catch {
		return fallback;
	}
}

export function mergeIntentPlanFromUserText(input: {
	userMessage: string;
	walletChainId: number | null | undefined;
	plannerPlan: PlannerOutput;
}): PlannerOutput {
	const lowered = input.userMessage.trim().toLowerCase();
	const localPlan = buildPlannerFallback({
		message: input.userMessage,
		walletChainId: input.walletChainId,
	});
	const localAmount = parseAmount(lowered);
	const localSourceChain = parseSourceChain(lowered);
	const localTargetChain = parseTargetChain(lowered) ?? parseChainByName(lowered);

	return {
		...input.plannerPlan,
		intent:
			localPlan.intent === 'intent.transfer' || input.plannerPlan.intent === 'unknown'
				? localPlan.intent
				: input.plannerPlan.intent,
		asset: 'USDC',
		amount: localAmount ?? input.plannerPlan.amount,
		sourceChain:
			localSourceChain ??
			input.plannerPlan.sourceChain ??
			localPlan.sourceChain,
		targetChain:
			localTargetChain ??
			input.plannerPlan.targetChain ??
			localPlan.targetChain,
		objective: input.plannerPlan.objective ?? localPlan.objective,
		mode: input.plannerPlan.mode ?? localPlan.mode,
	};
}
