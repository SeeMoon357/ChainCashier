'use client';

import { RedoOutlined, ShareAltOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Actions, Bubble, Think } from '@ant-design/x';
import type { ActionsProps, BubbleItemType } from '@ant-design/x';
import { Avatar } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import type { AgentStepEvent } from '@/lib/agentSteps';
import { upsertAgentStep } from '@/lib/agentSteps';
import type { AgentChatMode } from '@/lib/agentRuntime';
import type { ExecutionPreview } from '@/lib/executionRuntime';
import type { IntentFlightRecord } from '@/lib/lifiIntents';
import type { NormalizedVaultCandidate } from '@/lib/lifiRuntime';
import type { PlannerOutput } from '@/lib/plannerRuntime';
import {
	executePreviewTransaction,
	type ClientExecutionState,
} from '@/lib/executionClient';
import {
	CHAT_FIRST_USER_MESSAGE_EVENT,
	SIDEBAR_ACTIVE_CONVERSATION_EVENT,
	SIDEBAR_NEW_CONVERSATION_EVENT,
	SIDEBAR_REQUEST_NEW_CONVERSATION_EVENT,
	type SidebarActiveConversationDetail,
	type SidebarNewConversationDetail,
} from './chatEvents';
import ExecutionPreviewCard from './ExecutionPreviewCard';
import IntentFlightRecordCard from './IntentFlightRecordCard';
import Prompt from './Prompt';
import PillComposer from './ui/PillComposer';
import { buildChatBubbleItems } from '@/lib/chatBubbleItems';

type ChatMessage = {
	key: string;
	role: 'user' | 'ai' | 'system';
	content: string;
	reasoning?: string;
	streaming?: boolean;
	steps?: AgentStepEvent[];
	plan?: PlannerOutput;
	intentFlightRecord?: IntentFlightRecord;
	executionPreview?: ExecutionPreview;
	selectedVault?: NormalizedVaultCandidate | null;
	alternatives?: NormalizedVaultCandidate[];
	executionState?: ClientExecutionState;
};

type StreamPayload =
	| { type: 'thinking'; content: string }
	| { type: 'response'; content: string }
	| { type: 'error'; content?: string }
	| { type: 'done' }
	| { type: 'plan'; plan: PlannerOutput }
	| { type: 'intent_flight_record'; record: IntentFlightRecord }
	| AgentStepEvent
	| {
			type: 'execution_preview';
			preview: ExecutionPreview;
			selectedVault: NormalizedVaultCandidate | null;
			alternatives: NormalizedVaultCandidate[];
	  };

const AI_KEY_PREFIX = 'ai-';
const USER_KEY_PREFIX = 'user-';

const MOCK_CONVERSATION_MESSAGES: Record<string, ChatMessage[]> = {
	'conv-1': [
		{ key: 'user-1001', role: 'user', content: 'Find 5%+ APY vault on Base' },
		{
			key: 'ai-1001',
			role: 'ai',
			content:
				'Source: live\n\nRecommendation: RE7USDC by morpho-v1 on Base\n\nAPY: 5.71% | TVL: $2,051,223',
		},
	],
};

function toHistoryMessages(messages: ChatMessage[]) {
	return messages
		.filter(
			(message) =>
				(message.role === 'user' || message.role === 'ai') &&
				message.content.trim().length > 0,
		)
		.slice(-6)
		.map((message) => ({
			role: message.role as 'user' | 'ai',
			content: message.content,
		}));
}

function formatReasoningText(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) {
		return text;
	}

	const startIndex = trimmed.indexOf('{');
	const endIndex = trimmed.lastIndexOf('}');
	if (startIndex < 0 || endIndex <= startIndex) {
		return text;
	}

	const prefix = trimmed.slice(0, startIndex).trimEnd();
	const jsonText = trimmed.slice(startIndex, endIndex + 1);
	const suffix = trimmed.slice(endIndex + 1).trimStart();

	try {
		const parsed = JSON.parse(jsonText) as unknown;
		const prettyJson = JSON.stringify(parsed, null, 2);
		return [prefix, prettyJson, suffix].filter(Boolean).join('\n');
	} catch {
		return text;
	}
}

export default function ChatContent() {
	const { address: userAddress } = useAccount();
	const walletChainId = useChainId();
	const { switchChainAsync } = useSwitchChain();
	const { openConnectModal } = useConnectModal();
	const [value, setValue] = useState('');
	const [thinking, setThinking] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [currentAiKey, setCurrentAiKey] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [chatMode, setChatMode] = useState<AgentChatMode>('intent_lens');
	const wasConnectedRef = useRef(Boolean(userAddress));
	const streamAbortRef = useRef<AbortController | null>(null);
	const conversationRef = useRef<HTMLDivElement | null>(null);
	const pendingScrollRef = useRef(false);
	const messageIdRef = useRef(0);
	const activeStreamTokenRef = useRef(0);
	const hasUserMessageRef = useRef(false);

	const renderStepStatus = useCallback((status: AgentStepEvent['status']) => {
		switch (status) {
			case 'completed':
				return 'Done';
			case 'failed':
				return 'Failed';
			case 'running':
				return 'Running';
			default:
				return 'Pending';
		}
	}, []);

	const renderAgentSteps = useCallback(
		(steps: AgentStepEvent[] | undefined) => {
			if (!steps?.length) {
				return null;
			}

			return (
				<div className='mb-3 grid gap-2'>
					{steps.map((step) => (
						<div
							key={step.key}
							className='rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2'
						>
							<div className='flex items-center justify-between gap-3 text-xs'>
								<span className='font-medium text-black'>{step.title}</span>
								<span className='text-black/60'>
									{renderStepStatus(step.status)}
								</span>
							</div>
							<div className='mt-1 text-xs leading-5 text-black/70'>
								{step.summary}
							</div>
						</div>
					))}
				</div>
			);
		},
		[renderStepStatus],
	);

	const renderMarkdownContent = useCallback((text: string) => {
		if (!text) return null;

		return (
			<div className='chat-markdown whitespace-normal break-words text-sm leading-6'>
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					components={{
						p: ({ children }) => <p className='mb-2 last:mb-0'>{children}</p>,
						strong: ({ children }) => (
							<strong className='font-semibold'>{children}</strong>
						),
						em: ({ children }) => <em className='italic'>{children}</em>,
						ul: ({ children }) => (
							<ul className='mb-2 list-disc pl-5'>{children}</ul>
						),
						ol: ({ children }) => (
							<ol className='mb-2 list-decimal pl-5'>{children}</ol>
						),
						li: ({ children }) => <li className='mb-1'>{children}</li>,
						code: ({ children, className }) =>
							className ? (
								<code className='block overflow-x-auto rounded-xl bg-black/5 p-3 font-mono text-xs leading-5'>
									{children}
								</code>
							) : (
								<code className='rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em]'>
									{children}
								</code>
							),
						table: ({ children }) => (
							<div className='my-3 overflow-x-auto rounded-xl border border-black/10'>
								<table className='w-full border-collapse text-left text-sm'>
									{children}
								</table>
							</div>
						),
						thead: ({ children }) => (
							<thead className='bg-black/5'>{children}</thead>
						),
						th: ({ children }) => (
							<th className='border-b border-black/10 px-3 py-2 font-semibold'>
								{children}
							</th>
						),
						td: ({ children }) => (
							<td className='border-b border-black/10 px-3 py-2 align-top'>
								{children}
							</td>
						),
					}}
				>
					{text}
				</ReactMarkdown>
			</div>
		);
	}, []);

	const updateExecutionState = useCallback(
		(aiKey: string, executionState: ClientExecutionState) => {
			setMessages((prev) =>
				prev.map((message) =>
					message.key === aiKey
						? {
								...message,
								executionState,
							}
						: message,
				),
			);
		},
		[],
	);

	const enterClassicRouteMode = useCallback(() => {
		setChatMode('classic_route');
		setMessages((prev) => [
			...prev,
			{
				key: `ai-classic-mode-${Date.now()}`,
				role: 'ai',
				content:
					'Classic LI.FI route mode is ready. Ask a route-style question like "Preview a classic LI.FI route from Base USDC to Arbitrum USDC for 0.02 USDC".',
			},
		]);
		pendingScrollRef.current = true;
	}, []);

	const executeMessagePlan = useCallback(
		async (aiKey: string) => {
			const target = messages.find((message) => message.key === aiKey);
			if (!target?.executionPreview) {
				return;
			}

			try {
				await executePreviewTransaction({
					preview: target.executionPreview,
					switchChainAsync,
					onStateChange: (state) => updateExecutionState(aiKey, state),
				});
			} catch {
				// The execution client already emitted a terminal failed state.
			}
		},
		[messages, switchChainAsync, updateExecutionState],
	);

	const renderAiMessage = useCallback(
		(message: ChatMessage) => (
			<div>
				{renderAgentSteps(message.steps)}
				{renderMarkdownContent(message.content)}
				<IntentFlightRecordCard
					record={message.intentFlightRecord}
					onOpenClassicRoute={enterClassicRouteMode}
				/>
				<ExecutionPreviewCard
					plan={message.plan}
					preview={message.executionPreview}
					selectedVault={message.selectedVault}
					alternatives={message.alternatives}
					executionState={message.executionState}
					onExecute={() => {
						void executeMessagePlan(message.key);
					}}
				/>
			</div>
		),
		[executeMessagePlan, renderAgentSteps, renderMarkdownContent, enterClassicRouteMode],
	);

	const bubbleItems = useMemo<BubbleItemType[]>(
		() => buildChatBubbleItems(messages, renderAiMessage),
		[messages, renderAiMessage],
	);

	const scrollToLatest = useCallback((behavior: ScrollBehavior = 'auto') => {
		const container = conversationRef.current;
		if (!container) return;

		const bubbleScrollBox = container.querySelector<HTMLElement>(
			'.ant-bubble-list-scroll-box',
		);
		const scrollTarget = bubbleScrollBox ?? container;
		scrollTarget.scrollTo({
			top: scrollTarget.scrollHeight,
			behavior,
		});
	}, []);

	const scheduleScrollToLatest = useCallback(
		(behavior: ScrollBehavior = 'auto') => {
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(() => {
					scrollToLatest(behavior);
				});
			});
		},
		[scrollToLatest],
	);

	const clearAllTimers = useCallback(() => {
		activeStreamTokenRef.current += 1;
		if (streamAbortRef.current) {
			streamAbortRef.current.abort();
			streamAbortRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			clearAllTimers();
		};
	}, [clearAllTimers]);

	useEffect(() => {
		hasUserMessageRef.current = messages.some(
			(message) => message.role === 'user',
		);
	}, [messages]);

	useEffect(() => {
		if (userAddress) {
			wasConnectedRef.current = true;
			return;
		}

		if (wasConnectedRef.current) {
			window.location.href = '/';
		}
	}, [userAddress]);

	useEffect(() => {
		const handleNewConversation = (event: Event) => {
			const customEvent = event as CustomEvent<SidebarNewConversationDetail>;
			if (!customEvent.detail?.key) return;

			clearAllTimers();
			setValue('');
			setThinking(false);
			setGenerating(false);
			setCurrentAiKey(null);
			setChatMode('intent_lens');
			setMessages([]);
		};

		window.addEventListener(
			SIDEBAR_NEW_CONVERSATION_EVENT,
			handleNewConversation,
		);

		return () => {
			window.removeEventListener(
				SIDEBAR_NEW_CONVERSATION_EVENT,
				handleNewConversation,
			);
		};
	}, [clearAllTimers]);

	useEffect(() => {
		const handleActiveConversation = (event: Event) => {
			const customEvent = event as CustomEvent<SidebarActiveConversationDetail>;
			const conversationKey = customEvent.detail?.key;
			if (!conversationKey) return;

			const mockMessages = MOCK_CONVERSATION_MESSAGES[conversationKey];
			if (!mockMessages) return;

			clearAllTimers();
			setValue('');
			setThinking(false);
			setGenerating(false);
			setCurrentAiKey(null);
			setChatMode('intent_lens');
			setMessages(mockMessages);
			pendingScrollRef.current = true;
		};

		window.addEventListener(
			SIDEBAR_ACTIVE_CONVERSATION_EVENT,
			handleActiveConversation,
		);

		return () => {
			window.removeEventListener(
				SIDEBAR_ACTIVE_CONVERSATION_EVENT,
				handleActiveConversation,
			);
		};
	}, [clearAllTimers]);

	const sendMessage = useCallback(
		async (raw: string) => {
			const text = raw.trim();
			if (!text) return;
			if (!userAddress) {
				openConnectModal?.();
				return;
			}
			if (generating) return;

			if (!hasUserMessageRef.current) {
				window.dispatchEvent(
					new CustomEvent(SIDEBAR_REQUEST_NEW_CONVERSATION_EVENT, {
						detail: { source: 'composer' },
					}),
				);
				window.dispatchEvent(
					new CustomEvent(CHAT_FIRST_USER_MESSAGE_EVENT, {
						detail: { text },
					}),
				);
			}

			pendingScrollRef.current = true;
			clearAllTimers();

			const timeId = String(++messageIdRef.current);
			const streamToken = ++activeStreamTokenRef.current;
			const userKey = `${USER_KEY_PREFIX}${timeId}`;
			const aiKey = `${AI_KEY_PREFIX}${timeId}`;
			const history = toHistoryMessages(messages);

			setValue('');
			setThinking(true);
			setGenerating(true);
			setCurrentAiKey(aiKey);
			setMessages((prev) => [
				...prev,
				{ key: userKey, role: 'user', content: text },
				{
					key: aiKey,
					role: 'ai',
					content: '',
					reasoning: '',
					streaming: true,
					executionState: {
						status: 'idle',
						txHashes: [],
						explorerLinks: [],
					},
				},
			]);
			scheduleScrollToLatest('auto');

			const abortController = new AbortController();
			streamAbortRef.current = abortController;

			const applyChunk = (chunk: StreamPayload) => {
				if (activeStreamTokenRef.current !== streamToken) return;

				switch (chunk.type) {
					case 'thinking':
						setThinking(true);
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											reasoning: `${item.reasoning ?? ''}${chunk.content}`,
										}
									: item,
							),
						);
						scheduleScrollToLatest('auto');
						return;
					case 'response':
						setThinking(false);
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											content: `${item.content}${chunk.content}`,
										}
									: item,
							),
						);
						scheduleScrollToLatest('auto');
						return;
					case 'plan':
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											plan: chunk.plan,
										}
									: item,
							),
						);
						return;
					case 'intent_flight_record':
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											intentFlightRecord: chunk.record,
										}
									: item,
							),
						);
						scheduleScrollToLatest('auto');
						return;
					case 'step':
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											steps: upsertAgentStep(item.steps ?? [], chunk),
										}
									: item,
							),
						);
						scheduleScrollToLatest('auto');
						return;
					case 'execution_preview':
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											executionPreview: chunk.preview,
											selectedVault: chunk.selectedVault,
											alternatives: chunk.alternatives,
										}
									: item,
							),
						);
						scheduleScrollToLatest('auto');
						return;
					case 'error':
						setThinking(false);
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											content:
												item.content ||
												chunk.content ||
												'Request failed. Please retry.',
										}
									: item,
							),
						);
						return;
					case 'done':
						setThinking(false);
						setGenerating(false);
						setCurrentAiKey(null);
						setMessages((prev) =>
							prev.map((item) =>
								item.key === aiKey
									? {
											...item,
											streaming: false,
										}
									: item,
							),
						);
						return;
				}
			};

			try {
				const response = await fetch('/api/agents', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						message: text,
						userAddress,
						walletChainId,
						mode: chatMode,
						messages: history,
					}),
					signal: abortController.signal,
				});

				if (!response.ok || !response.body) {
					throw new Error(`Request failed with status ${response.status}.`);
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const events = buffer.split('\n\n');
					buffer = events.pop() ?? '';

					for (const event of events) {
						const dataLine = event
							.split('\n')
							.find((line) => line.startsWith('data: '));
						if (!dataLine) continue;

						const payload = JSON.parse(dataLine.slice(6)) as StreamPayload;
						applyChunk(payload);
					}
				}
			} catch (error) {
				if (abortController.signal.aborted) {
					return;
				}

				applyChunk({
					type: 'error',
					content:
						error instanceof Error
							? error.message
							: 'Request failed. Please retry later.',
				});
			} finally {
				if (streamAbortRef.current === abortController) {
					streamAbortRef.current = null;
				}
				setGenerating(false);
				setThinking(false);
				setCurrentAiKey(null);
				setMessages((prev) =>
					prev.map((item) =>
						item.key === aiKey
							? {
									...item,
									streaming: false,
								}
							: item,
					),
				);
			}
		},
		[
			clearAllTimers,
			generating,
			messages,
			openConnectModal,
			scheduleScrollToLatest,
			chatMode,
			userAddress,
			walletChainId,
		],
	);

	const hasUserMessage = messages.some((message) => message.role === 'user');

	useEffect(() => {
		if (!hasUserMessage) return;
		if (pendingScrollRef.current) {
			pendingScrollRef.current = false;
			scheduleScrollToLatest('smooth');
			return;
		}

		const rafId = window.requestAnimationFrame(() => {
			scrollToLatest('auto');
		});

		return () => {
			window.cancelAnimationFrame(rafId);
		};
	}, [hasUserMessage, messages, scrollToLatest, scheduleScrollToLatest]);

	const handleRetry = useCallback(
		(aiKey: string) => {
			if (generating) return;
			const sourceKey = aiKey.replace(/^ai-/, USER_KEY_PREFIX);
			const source = messages.find(
				(message) => message.key === sourceKey && message.role === 'user',
			);
			if (source?.content) {
				void sendMessage(source.content);
			}
		},
		[generating, messages, sendMessage],
	);

	const handleShare = useCallback(async (text: string) => {
		if (!text) return;
		try {
			if (navigator.share) {
				await navigator.share({ text });
				return;
			}
		} catch {
			// Ignore and fall back to clipboard.
		}

		if (navigator.clipboard) {
			await navigator.clipboard.writeText(text);
		}
	}, []);

	const createAiActions = useCallback(
		(data: BubbleItemType): ActionsProps['items'] => {
			const aiKey = String(data.key);
			const text = String(
				(data.extraInfo as ChatMessage | undefined)?.content ?? '',
			);

			return [
				{
					key: 'copy',
					actionRender: () => <Actions.Copy text={text} />,
				},
				{
					key: 'retry',
					icon: <RedoOutlined />,
					label: 'Retry',
					onItemClick: () => handleRetry(aiKey),
				},
				{
					key: 'share',
					icon: <ShareAltOutlined />,
					label: 'Share',
					onItemClick: () => {
						void handleShare(text);
					},
				},
			];
		},
		[handleRetry, handleShare],
	);

	const bubbleRole = useMemo(
		() => ({
			ai: (data: BubbleItemType) => {
				const message = data.extraInfo as ChatMessage | undefined;
				const isCurrentAiMessage = String(data.key) === currentAiKey;
				const isStreaming = Boolean(message?.streaming);
				const isAiMessage = String(data.key).startsWith(AI_KEY_PREFIX);
				const reasoningText = String(message?.reasoning ?? '');

				return {
					placement: 'start' as const,
					variant: 'outlined' as const,
					typing:
						isCurrentAiMessage && isStreaming
							? {
									effect: 'typing' as const,
									step: 1,
									interval: 22,
									keepPrefix: true,
								}
							: false,
					avatar: (
						<Avatar
							size={40}
							src='/intent-agent-logo.png'
						/>
					),
					header: isAiMessage ? (
						<Think
							title={
								isCurrentAiMessage && thinking
									? 'Thinking'
									: reasoningText
										? 'Reasoning'
										: 'Thinking'
							}
							loading={isCurrentAiMessage && thinking}
							defaultExpanded={false}
							style={{ marginBottom: 8 }}
						>
							{reasoningText ? (
								<div className='min-w-0 max-w-full whitespace-pre-wrap break-words text-xs leading-5 [overflow-wrap:anywhere] [word-break:break-word]'>
									{formatReasoningText(reasoningText)}
								</div>
							) : undefined}
						</Think>
					) : undefined,
					footer:
						isAiMessage && String(message?.content ?? '') && !isStreaming ? (
							<Actions
								items={createAiActions(data)}
								variant='borderless'
								fadeInLeft
							/>
						) : undefined,
					footerPlacement: 'outer-start' as const,
				};
			},
			user: { placement: 'end' as const, variant: 'filled' as const },
			system: { variant: 'borderless' as const },
		}),
		[createAiActions, currentAiKey, thinking],
	);

	const handleCancel = useCallback(() => {
		clearAllTimers();
		setThinking(false);
		setGenerating(false);
		setCurrentAiKey(null);
		const activeAiKey = currentAiKey;
		setMessages((prev) =>
			prev.map((item) =>
				item.key === activeAiKey
					? {
							...item,
							streaming: false,
						}
					: item,
			),
		);
	}, [clearAllTimers, currentAiKey]);

	return (
		<div className='flex-1 min-h-0 px-4 pb-4 flex flex-col gap-3'>
			<div className='mx-auto flex flex-1 w-full max-w-md sm:max-w-2xl lg:max-w-4xl flex-col min-h-0'>
				{!hasUserMessage && <Prompt onItemClick={sendMessage} />}

				{hasUserMessage && (
					<div
						ref={conversationRef}
						className='conversation-scroll-area intentlens-chat-shell min-h-0 flex-1 overflow-y-auto rounded-[22px] p-4 flex flex-col gap-4'
						style={{ scrollbarGutter: 'stable' }}
					>
						<Bubble.List
							items={bubbleItems}
							autoScroll={false}
							role={bubbleRole}
						/>
					</div>
				)}
			</div>

			<div className='mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-4xl flex-shrink-0'>
				{chatMode === 'classic_route' ? (
					<div className='mb-2 flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/55 px-3 py-2 text-xs text-gray-600 backdrop-blur-md'>
						<span className='font-medium text-gray-700'>Classic route mode</span>
						<button
							type='button'
							className='rounded-full border border-white/60 bg-white/70 px-2 py-1 font-medium text-gray-700 transition hover:bg-white'
							onClick={() => setChatMode('intent_lens')}
						>
							Back to Intents
						</button>
					</div>
				) : null}
				<PillComposer
					value={value}
					onChangeAction={setValue}
					onSubmitAction={sendMessage}
					loading={generating}
					onCancelAction={handleCancel}
				/>
			</div>
		</div>
	);
}
