export const DEFAULT_CHAIN_ID = 8453;
export const DEFAULT_QWEN_BASE_URL =
	'https://dashscope.aliyuncs.com/compatible-mode/v1';

type AgentRequestBody = {
	message?: unknown;
	userAddress?: unknown;
	chainId?: unknown;
	walletChainId?: unknown;
	messages?: unknown;
	mode?: unknown;
};

export type AgentChatMode = 'intent_lens' | 'classic_route';

type AgentRequestSuccess = {
	ok: true;
	value: {
		message: string;
		userAddress: string;
		chainId: number;
		walletChainId: number;
		mode: AgentChatMode;
		messages: Array<{
			role: 'user' | 'ai';
			content: string;
		}>;
	};
};

type AgentRequestFailure = {
	ok: false;
	error: string;
};

export function normalizeAgentRequest(
	body: AgentRequestBody | null | undefined,
): AgentRequestSuccess | AgentRequestFailure {
	const message =
		typeof body?.message === 'string' ? body.message.trim() : '';

	if (!message) {
		return {
			ok: false,
			error: 'Missing required field: message',
		};
	}

	const userAddress =
		typeof body?.userAddress === 'string' ? body.userAddress.trim() : '';

	if (!userAddress) {
		return {
			ok: false,
			error: 'Missing required field: userAddress',
		};
	}

	const explicitChainId =
		typeof body?.chainId === 'number' && Number.isFinite(body.chainId)
			? body.chainId
			: null;

	const walletChainId =
		typeof body?.walletChainId === 'number' &&
		Number.isFinite(body.walletChainId)
			? body.walletChainId
			: explicitChainId ?? DEFAULT_CHAIN_ID;

	const chainId = explicitChainId ?? walletChainId;
	const mode: AgentChatMode =
		body?.mode === 'classic_route' ? 'classic_route' : 'intent_lens';

	const messages = Array.isArray(body?.messages)
		? body.messages
				.map((item) => {
					if (
						item &&
						typeof item === 'object' &&
						(((item as { role?: unknown }).role === 'user') ||
							(item as { role?: unknown }).role === 'ai') &&
						typeof (item as { content?: unknown }).content === 'string'
					) {
						return {
							role: (item as { role: 'user' | 'ai' }).role,
							content: (item as { content: string }).content.trim(),
						};
					}

					return null;
				})
				.filter(
					(
						item,
					): item is {
						role: 'user' | 'ai';
						content: string;
					} => Boolean(item && item.content),
				)
		: [];

	return {
		ok: true,
		value: {
			message,
			userAddress,
			chainId,
			walletChainId,
			mode,
			messages,
		},
	};
}

export function getQwenBaseUrl(
	env: Record<string, string | undefined> = process.env,
): string {
	const explicitBaseUrl = env.QWEN_BASE_URL?.trim();
	if (explicitBaseUrl) {
		return explicitBaseUrl;
	}

	const legacyBaseUrl = env.BASE_URL?.trim();
	if (legacyBaseUrl) {
		return legacyBaseUrl;
	}

	return DEFAULT_QWEN_BASE_URL;
}
