export type AgentRunStep =
	| 'plan'
	| 'invoice'
	| 'link'
	| 'source'
	| 'quote'
	| 'validate'
	| 'wallet'
	| 'status'
	| 'receipt'
	| 'repair';

export type AgentRunEventStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'action_required';

export type AgentRunEvent = {
	id: string;
	step: AgentRunStep;
	status: AgentRunEventStatus;
	summary: string;
	tool?: string;
	inputSummary?: string;
	outputSummary?: string;
	validation?: string[];
	repairAction?: string;
	artifact?: string;
	timestamp: number;
};

export type AgentRunLog = {
	runId: string;
	userGoal: string;
	plan: string[];
	toolCalls: string[];
	validation: string[];
	repairActions: string[];
	finalArtifacts: string[];
	events: AgentRunEvent[];
	safetyBoundary: string;
};

export function createRunEvent(
	input: Omit<AgentRunEvent, 'id' | 'timestamp'> & {
		id?: string;
		timestamp?: number;
	},
): AgentRunEvent {
	const timestamp = input.timestamp ?? Date.now();
	return {
		...input,
		id: input.id ?? `${input.step}-${timestamp}`,
		timestamp,
	};
}

export function buildAgentRunLog(input: {
	runId: string;
	userGoal: string;
	events: AgentRunEvent[];
}): AgentRunLog {
	return {
		runId: input.runId,
		userGoal: input.userGoal,
		plan: input.events
			.filter((event) => event.step === 'plan')
			.map((event) => event.summary),
		toolCalls: [
			...new Set(
				input.events
					.map((event) => event.tool)
					.filter((tool): tool is string => Boolean(tool)),
			),
		],
		validation: input.events.flatMap((event) => event.validation ?? []),
		repairActions: input.events
			.map((event) => event.repairAction)
			.filter((action): action is string => Boolean(action)),
		finalArtifacts: [
			...new Set(
				input.events
					.map((event) => event.artifact)
					.filter((artifact): artifact is string => Boolean(artifact)),
			),
		],
		events: input.events,
		safetyBoundary:
			'Agent never signs wallet transactions, never custodies funds, and requires user wallet confirmation before assets move.',
	};
}
