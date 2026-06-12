'use client';

import {
	AudioOutlined,
	CloudUploadOutlined,
	PaperClipOutlined,
	SearchOutlined,
	OpenAIOutlined,
	AntDesignOutlined,
} from '@ant-design/icons';
import { Attachments, type AttachmentsProps, Sender } from '@ant-design/x';
import {
	Button,
	Divider,
	Flex,
	message,
	theme,
	type GetProp,
	type GetRef,
} from 'antd';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

const CHAT_SENDER_TEXT = {
	placeholder: '请输入内容，回车发送',
	attachmentsTitle: 'Attachments',
	dropFileTitle: 'Drop file here',
	uploadFileTitle: 'Upload files',
	uploadFileDescription: 'Click or drag files to this area to upload',
	deepThinking: 'Deep Thinking',
	webSearch: 'Web Search',
	agentMode: 'Agent Mode',
	skillAndMcp: 'Skill & MCP',
	toggleAttachments: '切换附件面板',
	voiceInput: '语音输入',
} as const;

type FooterSwitchItem = {
	key: string;
	label: string;
	icon: ReactNode;
	value: boolean;
	onChange: (checked: boolean) => void;
};

function FooterDivider() {
	return (
		<Divider
			orientation='vertical'
			style={{ marginInline: 4, height: 16 }}
		/>
	);
}

type SpeechRecognitionResultLike = {
	transcript?: string;
};

type SpeechRecognitionEventLike = {
	results?: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};

type SpeechRecognitionLike = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onstart: (() => void) | null;
	onend: (() => void) | null;
	onerror: (() => void) | null;
	onresult: ((event: SpeechRecognitionEventLike) => void) | null;
	start: () => void;
	stop: () => void;
};

type WindowWithSpeechRecognition = Window & {
	SpeechRecognition?: new () => SpeechRecognitionLike;
	webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface ChatSenderProps {
	value: string;
	onChangeAction: (value: string) => void;
	onSubmitAction: (value: string) => void;
	onCancelAction?: () => void;
	loading?: boolean;
}

export default function ChatSender({
	value,
	onChangeAction,
	onSubmitAction,
	onCancelAction,
	loading = false,
}: ChatSenderProps) {
	const { token } = theme.useToken();

	const [deepThinking, setDeepThinking] = useState(false);
	const [webSearch, setWebSearch] = useState(false);
	const [agentMode, setAgentMode] = useState(false);
	const [isRecording, setIsRecording] = useState(false);

	const [open, setOpen] = useState(false);
	const [attachments, setAttachments] = useState<
		GetProp<AttachmentsProps, 'items'>
	>([]);

	const senderRef = useRef<GetRef<typeof Sender>>(null);
	const attachmentsRef = useRef<GetRef<typeof Attachments>>(null);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const valueRef = useRef(value);
	const objectUrlMapRef = useRef<Map<string, string>>(new Map());

	const iconStyle = useMemo(
		() => ({
			fontSize: 15,
			color: token.colorText,
		}),
		[token.colorText],
	);

	const getAttachmentUid = useCallback(
		(item: NonNullable<GetProp<AttachmentsProps, 'items'>>[number]) =>
			String(item.uid ?? item.name ?? 'unknown'),
		[],
	);

	const revokeAllObjectUrls = useCallback(() => {
		objectUrlMapRef.current.forEach((url) => {
			URL.revokeObjectURL(url);
		});
		objectUrlMapRef.current.clear();
	}, []);

	const cleanupRemovedObjectUrls = useCallback(
		(nextList: GetProp<AttachmentsProps, 'items'> = []) => {
			const activeUids = new Set(
				nextList.map((item) => getAttachmentUid(item)),
			);
			objectUrlMapRef.current.forEach((url, uid) => {
				if (!activeUids.has(uid)) {
					URL.revokeObjectURL(url);
					objectUrlMapRef.current.delete(uid);
				}
			});
		},
		[getAttachmentUid],
	);

	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const speechWindow = window as WindowWithSpeechRecognition;

		const SpeechRecognitionCtor =
			speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

		if (!SpeechRecognitionCtor) {
			return;
		}

		const recognition = new SpeechRecognitionCtor();
		recognition.lang = 'zh-CN';
		recognition.continuous = false;
		recognition.interimResults = false;

		recognition.onstart = () => {
			setIsRecording(true);
		};

		recognition.onend = () => {
			setIsRecording(false);
		};

		recognition.onerror = () => {
			setIsRecording(false);
			message.warning('语音识别启动失败，请检查麦克风权限。');
		};

		recognition.onresult = (event: SpeechRecognitionEventLike) => {
			const transcript = event?.results?.[0]?.[0]?.transcript?.trim?.();
			if (!transcript) return;

			const nextValue = valueRef.current
				? `${valueRef.current} ${transcript}`
				: transcript;
			onChangeAction(nextValue);
		};

		recognitionRef.current = recognition;

		return () => {
			recognitionRef.current?.stop?.();
			recognitionRef.current = null;
		};
	}, [onChangeAction]);

	useEffect(() => {
		return () => {
			revokeAllObjectUrls();
		};
	}, []);

	const normalizeAttachmentItems = useCallback(
		(
			fileList: GetProp<AttachmentsProps, 'items'> = [],
		): GetProp<AttachmentsProps, 'items'> =>
			fileList.map((item) => {
				const uid = getAttachmentUid(item);
				const mimeType = item.type ?? '';
				const isImage = mimeType.startsWith('image/');

				if (!isImage) {
					return item;
				}

				let src = item.thumbUrl ?? item.url;

				if (!src && item.originFileObj instanceof Blob) {
					const cached = objectUrlMapRef.current.get(uid);
					if (cached) {
						src = cached;
					} else {
						const objectUrl = URL.createObjectURL(item.originFileObj);
						objectUrlMapRef.current.set(uid, objectUrl);
						src = objectUrl;
					}
				}

				return {
					...item,
					cardType: 'image',
					src,
					imageProps: {
						preview: true,
						style: {
							width: '100%',
							height: 220,
							objectFit: 'cover',
						},
					},
				};
			}),
		[getAttachmentUid],
	);

	const handleVoiceClick = useCallback(() => {
		if (!recognitionRef.current) {
			message.info('当前浏览器不支持语音识别，请使用 Chrome 或 Edge。');
			return;
		}

		try {
			if (isRecording) {
				recognitionRef.current.stop();
				return;
			}
			recognitionRef.current.start();
		} catch {
			message.warning('无法启动语音识别，请检查麦克风权限。');
		}
	}, [isRecording]);

	const handleSubmit = useCallback(
		(nextValue: string) => {
			if (loading) return;
			const text = (nextValue ?? valueRef.current ?? '').trim();
			if (!text) return;

			recognitionRef.current?.stop?.();
			setIsRecording(false);
			onSubmitAction(text);
			revokeAllObjectUrls();
			setAttachments([]);
			setOpen(false);
		},
		[loading, onSubmitAction, revokeAllObjectUrls],
	);

	const handleAttachmentChange = useCallback(
		({
			fileList,
		}: {
			fileList: NonNullable<GetProp<AttachmentsProps, 'items'>>;
		}) => {
			const normalized = normalizeAttachmentItems(fileList);
			cleanupRemovedObjectUrls(normalized);
			setAttachments(normalized);
		},
		[cleanupRemovedObjectUrls, normalizeAttachmentItems],
	);

	const attachmentPlaceholder: NonNullable<AttachmentsProps['placeholder']> =
		useCallback(
			(type: string) =>
				type === 'drop'
					? {
							title: CHAT_SENDER_TEXT.dropFileTitle,
						}
					: {
							icon: <CloudUploadOutlined />,
							title: CHAT_SENDER_TEXT.uploadFileTitle,
							description: CHAT_SENDER_TEXT.uploadFileDescription,
						},
			[],
		);

	const modelSwitchItems = useMemo<FooterSwitchItem[]>(() => [], []);

	const senderHeader = (
		<Sender.Header
			title={CHAT_SENDER_TEXT.attachmentsTitle}
			open={open}
			onOpenChange={setOpen}
			forceRender
			styles={{
				content: {
					padding: 0,
				},
			}}
		>
			<Attachments
				ref={attachmentsRef}
				beforeUpload={() => false}
				multiple
				items={attachments}
				overflow='wrap'
				onChange={handleAttachmentChange}
				placeholder={attachmentPlaceholder}
				getDropContainer={() => senderRef.current?.nativeElement}
			/>
		</Sender.Header>
	);

	return (
		<Sender
			className='chat-sender'
			ref={senderRef}
			header={senderHeader}
			value={value}
			disabled={loading}
			loading={loading}
			onChange={(nextValue) => {
				valueRef.current = nextValue;
				onChangeAction(nextValue);
			}}
			suffix={false}
			autoSize={{ minRows: 1, maxRows: 3 }}
			placeholder={CHAT_SENDER_TEXT.placeholder}
			submitType='enter'
			onPasteFile={(files) => {
				for (const file of files) {
					attachmentsRef.current?.upload(file);
				}
				setOpen(true);
			}}
			onSubmit={handleSubmit}
			onCancel={() => {
				recognitionRef.current?.stop?.();
				setIsRecording(false);
				onCancelAction?.();
				setOpen(false);
			}}
			footer={(actionsNode) => {
				return (
					<Flex
						className='chat-sender-custom-footer'
						justify='flex-end'
						align='center'
						gap='small'
					>
						{actionsNode}
					</Flex>
				);
			}}
		/>
	);
}
