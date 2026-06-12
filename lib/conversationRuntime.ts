export type ConversationRecord = {
	key: string;
	title: string;
	createdAt: string;
};

export type PendingConversationRecord = {
	key: string;
	createdAt: string;
} | null;

export const DEFAULT_CONVERSATION_TITLE = 'New conversation';

export function toConversationTitle(text: string, maxLength = 28) {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) {
		return DEFAULT_CONVERSATION_TITLE;
	}

	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength)}...`
		: normalized;
}

export function createOrReusePendingConversation(input: {
	conversations: ConversationRecord[];
	pendingConversation: PendingConversationRecord;
	nextKey: string;
	createdAt: string;
}) {
	if (input.pendingConversation) {
		return {
			conversations: input.conversations,
			activeKey: input.pendingConversation.key,
			pendingConversation: input.pendingConversation,
			reused: true,
		};
	}

	const nextConversation: ConversationRecord = {
		key: input.nextKey,
		title: DEFAULT_CONVERSATION_TITLE,
		createdAt: input.createdAt,
	};

	return {
		conversations: [
			nextConversation,
			...input.conversations.filter((item) => item.key !== input.nextKey),
		],
		activeKey: nextConversation.key,
		pendingConversation: {
			key: input.nextKey,
			createdAt: input.createdAt,
		},
		reused: false,
	};
}

export function applyFirstMessageToPendingConversation(input: {
	conversations: ConversationRecord[];
	pendingConversation: PendingConversationRecord;
	text: string;
}) {
	const pendingConversation = input.pendingConversation;
	const text = input.text.trim();

	if (!pendingConversation || !text) {
		return {
			conversations: input.conversations,
			activeKey: pendingConversation?.key,
			pendingConversation,
			updated: false,
		};
	}

	return {
		conversations: input.conversations.map((item) =>
			item.key === pendingConversation.key
				? {
						...item,
						title: toConversationTitle(text),
					}
				: item,
		),
		activeKey: pendingConversation.key,
		pendingConversation: null,
		updated: true,
	};
}
