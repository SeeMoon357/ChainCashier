import type { ReactNode } from 'react';
import type { AgentStepEvent } from './agentSteps';

export type ChatBubbleMessage = {
	key: string;
	role: 'user' | 'ai' | 'system';
	content: string;
	reasoning?: string;
	streaming?: boolean;
	steps?: AgentStepEvent[];
	executionState?: unknown;
	executionPreview?: unknown;
	selectedVault?: unknown;
};

export type ChatBubbleItem = {
	key: string;
	role: ChatBubbleMessage['role'];
	content: string | ReactNode;
	extraInfo: ChatBubbleMessage;
};

export function buildChatBubbleItems<T extends ChatBubbleMessage>(
	messages: T[],
	renderAiContent: (message: T) => string | ReactNode,
): Array<ChatBubbleItem & { extraInfo: T }> {
	return messages.map((message) => ({
		key: message.key,
		role: message.role,
		content:
			message.role === 'ai' ? renderAiContent(message) : message.content,
		extraInfo: message,
	}));
}
