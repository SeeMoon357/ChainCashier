'use client';

import {
	DeleteOutlined,
	EditOutlined,
	MoreOutlined,
	SearchOutlined,
	ShareAltOutlined,
} from '@ant-design/icons';

import {
	Conversations,
	type ConversationItemType,
	type ConversationsProps,
} from '@ant-design/x';
import type { MenuProps } from 'antd';
import { Button, Input, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	CHAT_FIRST_USER_MESSAGE_EVENT,
	SIDEBAR_ACTIVE_CONVERSATION_EVENT,
	SIDEBAR_NEW_CONVERSATION_EVENT,
	SIDEBAR_REQUEST_NEW_CONVERSATION_EVENT,
	type ChatFirstUserMessageDetail,
} from './chatEvents';
import {
	applyFirstMessageToPendingConversation,
	createOrReusePendingConversation,
	type ConversationRecord,
	type PendingConversationRecord,
} from '@/lib/conversationRuntime';

const INITIAL_CONVERSATIONS: ConversationRecord[] = [];

function formatConversationTime(isoString: string) {
	const date = new Date(isoString);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');

	return `${year}-${month}-${day} ${hour}:${minute}`;
}

export default function Sidebar() {
	const [isOpen, setIsOpen] = useState(true);
	const [keyword, setKeyword] = useState('');
	const [conversations, setConversations] = useState<ConversationRecord[]>(
		INITIAL_CONVERSATIONS,
	);
	const [activeKey, setActiveKey] = useState<string | undefined>(
		INITIAL_CONVERSATIONS[0]?.key,
	);
	const idRef = useRef(INITIAL_CONVERSATIONS.length + 1);
	const pendingConversationRef = useRef<PendingConversationRecord>(null);
	const conversationsRef = useRef(INITIAL_CONVERSATIONS);

	useEffect(() => {
		conversationsRef.current = conversations;
	}, [conversations]);

	const createConversation = useCallback(() => {
		const nowIso = new Date().toISOString();
		const nextKey = `conv-${idRef.current}`;
		const result = createOrReusePendingConversation({
			conversations: conversationsRef.current,
			pendingConversation: pendingConversationRef.current,
			nextKey,
			createdAt: nowIso,
		});
		pendingConversationRef.current = result.pendingConversation;
		conversationsRef.current = result.conversations;
		if (!result.reused) {
			idRef.current += 1;
		}

		setConversations(result.conversations);
		setActiveKey(result.activeKey);
		window.dispatchEvent(
			new CustomEvent(SIDEBAR_NEW_CONVERSATION_EVENT, {
				detail: { key: result.activeKey },
			}),
		);
	}, []);

	useEffect(() => {
		const handleFirstMessage = (event: Event) => {
			const customEvent = event as CustomEvent<ChatFirstUserMessageDetail>;
			const text = customEvent.detail?.text?.trim();
			if (!text) return;

			const result = applyFirstMessageToPendingConversation({
				conversations: conversationsRef.current,
				pendingConversation: pendingConversationRef.current,
				text,
			});
			if (!result.updated) return;

			conversationsRef.current = result.conversations;
			setConversations(result.conversations);
			setActiveKey(result.activeKey);
			pendingConversationRef.current = result.pendingConversation;
		};

		window.addEventListener(CHAT_FIRST_USER_MESSAGE_EVENT, handleFirstMessage);
		window.addEventListener(
			SIDEBAR_REQUEST_NEW_CONVERSATION_EVENT,
			createConversation,
		);

		return () => {
			window.removeEventListener(
				CHAT_FIRST_USER_MESSAGE_EVENT,
				handleFirstMessage,
			);
			window.removeEventListener(
				SIDEBAR_REQUEST_NEW_CONVERSATION_EVENT,
				createConversation,
			);
		};
	}, [createConversation]);

	const filteredConversations = useMemo(() => {
		const text = keyword.trim().toLowerCase();
		return conversations
			.filter((item) => item.title.toLowerCase().includes(text))
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
	}, [conversations, keyword]);

	const conversationItems = useMemo<ConversationsProps['items']>(() => {
		return filteredConversations.map((item) => ({
			key: item.key,
			label: (
				<div className='flex min-w-0 flex-col py-2'>
					<span className='text-sm font-medium truncate text-[var(--app-text)]'>
						{item.title}
					</span>
					<span className='text-[11px] text-[var(--app-muted)]'>
						{formatConversationTime(item.createdAt)}
					</span>
				</div>
			),
		}));
	}, [filteredConversations]);

	const handleShare = useCallback(async (record: ConversationRecord) => {
		const shareText = `${record.title} (${formatConversationTime(record.createdAt)})`;
		try {
			if (navigator.share) {
				await navigator.share({ text: shareText });
			} else if (navigator.clipboard) {
				await navigator.clipboard.writeText(shareText);
				message.success('会话内容已复制，可直接分享。');
			} else {
				message.info('当前环境不支持系统分享。');
			}
		} catch {
			message.info('已取消分享。');
		}
	}, []);

	const handleDelete = useCallback((key: string) => {
		setConversations((prev) => {
			const nextList = prev.filter((item) => item.key !== key);
			conversationsRef.current = nextList;
			setActiveKey((prevActive) =>
				prevActive === key ? nextList[0]?.key : prevActive,
			);
			return nextList;
		});

		if (pendingConversationRef.current?.key === key) {
			pendingConversationRef.current = null;
		}
	}, []);

	const conversationMenu = useCallback(
		(value: ConversationItemType) => ({
			trigger: (
				<Button
					type='text'
					size='small'
					className='sidebar-action-btn'
					icon={<MoreOutlined />}
					aria-label='会话操作菜单'
				/>
			),
			items: [
				{ key: 'share', label: '分享', icon: <ShareAltOutlined /> },
				{
					key: 'delete',
					label: '删除',
					danger: true,
					icon: <DeleteOutlined />,
				},
			],
			onClick: (info: Parameters<NonNullable<MenuProps['onClick']>>[0]) => {
				const { key } = info;
				const record = conversations.find((item) => item.key === value.key);
				if (!record) return;

				if (key === 'share') {
					void handleShare(record);
					return;
				}

				if (key === 'delete') {
					handleDelete(record.key);
				}
			},
		}),
		[conversations, handleDelete, handleShare],
	);

	const handleActiveConversationChange = useCallback((key: string) => {
		setActiveKey(key);
		window.dispatchEvent(
			new CustomEvent(SIDEBAR_ACTIVE_CONVERSATION_EVENT, {
				detail: { key },
			}),
		);
	}, []);

	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth < 768) {
				setIsOpen(false);
			} else {
				setIsOpen(true);
			}
		};

		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	return (
		<nav
			id='sidebar'
			className={`relative z-10 flex flex-shrink-0 flex-col border-r border-[var(--app-border)] [background:var(--app-sidebar)] backdrop-blur-xl transition-all duration-300 overflow-hidden ${
				isOpen ? 'w-[260px]' : 'w-[68px]'
			}`}
		>
			<div className='h-14'></div>
			<button
				aria-label='toggle sidebar'
				className='absolute top-4 right-2 z-10 cursor-pointer w-6 h-6 rounded hover:bg-[var(--app-hover)] transition-colors flex items-center justify-center'
				onClick={() => setIsOpen((prev) => !prev)}
			>
				<span className='flex flex-col gap-[3px]'>
					<span className='block w-3.5 h-[1.5px] rounded-full bg-current' />
					<span className='block w-3.5 h-[1.5px] rounded-full bg-current' />
					<span className='block w-3.5 h-[1.5px] rounded-full bg-current' />
				</span>
			</button>

			{isOpen && (
				<>
					<div className='px-3 pb-3 space-y-2'>
						<Button
							block
							type='default'
							icon={<EditOutlined />}
							onClick={createConversation}
							className='!h-10 !rounded-lg !border-[var(--app-border)] !bg-transparent !text-[var(--app-text)] hover:!bg-[var(--app-hover)]'
						>
							新增对话
						</Button>
						<Input
							allowClear
							value={keyword}
							onChange={(event) => setKeyword(event.target.value)}
							prefix={<SearchOutlined />}
							placeholder='搜索对话'
							className='sidebar-search'
						/>
					</div>
					<div>
						<Conversations
							className='sidebar-conversations'
							items={conversationItems}
							activeKey={activeKey}
							onActiveChange={(value) => handleActiveConversationChange(value)}
							menu={conversationMenu}
						/>
					</div>
				</>
			)}
		</nav>
	);
}
