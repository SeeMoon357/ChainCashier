export type AgentStepKey =
	| 'planning'
	| 'vault_search'
	| 'portfolio_check'
	| 'quote_build'
	| 'recommendation_ready';

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AgentStepEvent = {
	type: 'step';
	key: AgentStepKey;
	title: string;
	status: AgentStepStatus;
	summary: string;
	data?: unknown;
};

const STEP_TITLES: Record<AgentStepKey, string> = {
	planning: 'Planning',
	vault_search: 'Vault Search',
	portfolio_check: 'Portfolio Check',
	quote_build: 'Quote Build',
	recommendation_ready: 'Recommendation Ready',
};

export function createAgentStepEvent(
	key: AgentStepKey,
	status: AgentStepStatus,
	summary: string,
	data?: unknown,
): AgentStepEvent {
	return {
		type: 'step',
		key,
		title: STEP_TITLES[key],
		status,
		summary,
		...(data === undefined ? {} : { data }),
	};
}

export function upsertAgentStep(
	steps: AgentStepEvent[],
	nextStep: AgentStepEvent,
): AgentStepEvent[] {
	const existingIndex = steps.findIndex((step) => step.key === nextStep.key);
	if (existingIndex === -1) {
		return [...steps, nextStep];
	}

	return steps.map((step, index) =>
		index === existingIndex ? nextStep : step,
	);
}
