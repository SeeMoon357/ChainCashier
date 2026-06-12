'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseAbi } from 'viem';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import { AlertTriangle, CheckCircle2, CircleDashed, Copy, ExternalLink, ReceiptText, Wallet } from 'lucide-react';
import WalletButton from './WalletConnect';
import type { Invoice, PaymentQuoteSummary, SupportPackage } from '@/lib/chainCashier';
import type { PayerSourceOption } from '@/lib/chainCashierChat';
import { splitTypewriterText } from '@/lib/chainCashierStreaming';

const ChatSender = dynamic(() => import('./ChatSender'), {
	ssr: false,
	loading: () => <div className='h-14 rounded-2xl bg-white' />,
});

const erc20Abi = parseAbi([
	'function approve(address spender, uint256 amount) returns (bool)',
]);

type ChatRole = 'merchant' | 'payer';

type ChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	reasoning?: string;
	streaming?: boolean;
	invoice?: Invoice;
	source?: PayerSourceOption;
	quote?: PaymentQuoteSummary;
	rawQuote?: unknown;
	receipt?: unknown;
	supportPackage?: SupportPackage;
};

type FlowStep = {
	key: string;
	title: string;
	status: 'pending' | 'running' | 'done' | 'failed';
	note: string;
};

type PendingEvent =
	| {
			type: 'text';
			messageId: string;
			field: 'content' | 'reasoning';
			token: string;
	  }
	| {
			type: 'patch';
			messageId: string;
			patch: Partial<ChatMessage>;
	  };

type StreamPayload =
	| { type: 'thinking'; content: string }
	| { type: 'response'; content: string }
	| { type: 'invoice'; invoice: Invoice }
	| { type: 'payer_source'; source: PayerSourceOption }
	| { type: 'quote_request'; source: PayerSourceOption; request: unknown }
	| { type: 'quote'; quote: PaymentQuoteSummary; rawQuote?: unknown }
	| { type: 'error'; content: string }
	| { type: 'done' };

function initialSteps(): FlowStep[] {
	return [
		{ key: 'parse', title: 'Merchant Goal Parsed', status: 'pending', note: 'GLM-5.1 turns merchant language into a locked invoice.' },
		{ key: 'invoice', title: 'Invoice Created', status: 'pending', note: 'Merchant address, Base USDC target, amount, and fee policy are locked.' },
		{ key: 'link', title: 'Payment Link Generated', status: 'pending', note: 'The payer opens an independent checkout chat from this link.' },
		{ key: 'source', title: 'Payer Source Selected', status: 'pending', note: 'Payer chooses the source chain and token in chat.' },
		{ key: 'quote', title: 'LI.FI Quote Requested', status: 'pending', note: 'The app asks LI.FI for a toAmount quote so merchant receives exact Base USDC.' },
		{ key: 'explain', title: 'Fee & Risk Explained', status: 'pending', note: 'Agent explains payer cost, fee policy, and wallet confirmation boundary.' },
		{ key: 'wallet', title: 'Wallet Confirmation Required', status: 'pending', note: 'Funds move only after payer signs in their wallet.' },
		{ key: 'submitted', title: 'Payment Submitted', status: 'pending', note: 'The source transaction hash is saved to the invoice.' },
		{ key: 'status', title: 'LI.FI Status Tracking', status: 'pending', note: 'The app polls LI.FI status until paid, failed, or refunded.' },
		{ key: 'receipt', title: 'Receipt Generated', status: 'pending', note: 'Receipt JSON and support package are generated from the evidence.' },
	];
}

function updateStep(
	steps: FlowStep[],
	key: string,
	status: FlowStep['status'],
	note?: string,
): FlowStep[] {
	return steps.map((step) =>
		step.key === key ? { ...step, status, note: note ?? step.note } : step,
	);
}

function failRunningStep(steps: FlowStep[], note: string): FlowStep[] {
	const running = steps.find((step) => step.status === 'running');
	if (!running) return steps;
	return updateStep(steps, running.key, 'failed', note);
}

function invoiceStorageKey(invoiceId: string): string {
	return `chaincashier:invoice:${invoiceId}`;
}

function saveInvoiceToBrowser(invoice: Invoice) {
	window.localStorage.setItem(invoiceStorageKey(invoice.invoiceId), JSON.stringify(invoice));
	window.localStorage.setItem('chaincashier:latestInvoiceId', invoice.invoiceId);
}

function loadInvoiceFromBrowser(invoiceId: string): Invoice | null {
	const raw = window.localStorage.getItem(invoiceStorageKey(invoiceId));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Invoice;
	} catch {
		return null;
	}
}

function formatUnits(value?: string): string {
	if (!value || !/^\d+$/.test(value)) return 'n/a';
	const units = BigInt(value);
	const decimals = BigInt(1_000_000);
	const whole = units / decimals;
	const fraction = (units % decimals).toString().padStart(6, '0').replace(/0+$/, '');
	return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function Markdown({ text }: { text: string }) {
	return (
		<div className='prose prose-sm max-w-none prose-slate'>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
		</div>
	);
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
	return (
		<div className='mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950'>
			<div className='font-semibold'>{invoice.invoiceId}</div>
			<div className='mt-1'>Merchant receives: {invoice.receiveAmount} {invoice.receiveToken} on {invoice.receiveChain}</div>
			<div>Merchant address: <span className='break-all'>{invoice.merchantAddress}</span></div>
			<div>Fee policy: {invoice.feePolicy}</div>
			<a
				href={invoice.paymentLink}
				className='mt-2 inline-flex items-center gap-1 break-all font-medium text-emerald-800 underline'
			>
				<ExternalLink className='h-4 w-4' />
				{invoice.paymentLink}
			</a>
		</div>
	);
}

function QuoteCard({
	quote,
	onPay,
	disabled,
}: {
	quote: PaymentQuoteSummary;
	onPay: () => void;
	disabled: boolean;
}) {
	return (
		<div className='mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm'>
			<div className='font-semibold'>LI.FI quote</div>
			<div className='mt-2'>Payer pays estimated: {formatUnits(quote.estimatedFromAmount)} USDC</div>
			<div>Merchant target amount: {formatUnits(quote.targetToAmount)} USDC</div>
			<div>Minimum received: {formatUnits(quote.toAmountMin ?? quote.targetToAmount)} USDC</div>
			<div>Estimated fees: ${quote.estimatedFeesUsd ?? 'n/a'}</div>
			<div className='mt-1 text-xs text-slate-500'>{quote.routeSummary}</div>
			<button
				type='button'
				onClick={onPay}
				disabled={disabled || !quote.transactionRequest}
				className='mt-3 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300'
			>
				<Wallet className='h-4 w-4' />
				Approve & Pay With Wallet
			</button>
		</div>
	);
}

function ReceiptCard({ value }: { value: unknown }) {
	return (
		<details className='mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm'>
			<summary className='flex cursor-pointer items-center gap-2 font-semibold'>
				<ReceiptText className='h-4 w-4' />
				Receipt / support package
			</summary>
			<pre className='mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100'>
				{JSON.stringify(value, null, 2)}
			</pre>
		</details>
	);
}

function StatusIcon({ status }: { status: FlowStep['status'] }) {
	if (status === 'done') return <CheckCircle2 className='h-4 w-4 text-emerald-600' />;
	if (status === 'failed') return <AlertTriangle className='h-4 w-4 text-rose-600' />;
	return (
		<CircleDashed
			className={status === 'running' ? 'h-4 w-4 text-sky-600' : 'h-4 w-4 text-slate-400'}
		/>
	);
}

function FlowRecorder({ steps }: { steps: FlowStep[] }) {
	return (
		<aside className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-auto'>
			<div className='text-sm font-semibold text-slate-700'>Payment Flow Recorder</div>
			<div className='mt-3 space-y-2'>
				{steps.map((step) => (
					<div
						key={step.key}
						className='grid grid-cols-[auto_1fr] gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2'
					>
						<StatusIcon status={step.status} />
						<div>
							<div className='text-sm font-medium'>{step.title}</div>
							<div className='mt-1 text-xs leading-5 text-slate-600'>{step.note}</div>
						</div>
					</div>
				))}
			</div>
			<div className='mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900'>
				Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
			</div>
		</aside>
	);
}

function initialPrompt(role: ChatRole): string {
	if (role === 'merchant') {
		return 'Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.';
	}
	return 'I want to pay with USDC on Arbitrum.';
}

export default function ChainCashierChat({
	role,
	initialInvoiceId,
}: {
	role: ChatRole;
	initialInvoiceId?: string;
}) {
	const { address, isConnected } = useAccount();
	const chainId = useChainId();
	const { openConnectModal } = useConnectModal();
	const { data: walletClient } = useWalletClient();
	const publicClient = usePublicClient();
	const { switchChainAsync } = useSwitchChain();
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [invoice, setInvoice] = useState<Invoice | null>(null);
	const [source, setSource] = useState<PayerSourceOption | null>(null);
	const [steps, setSteps] = useState<FlowStep[]>(initialSteps);
	const [busy, setBusy] = useState(false);
	const [paying, setPaying] = useState(false);
	const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const messageIdRef = useRef(0);
	const textQueueRef = useRef<PendingEvent[]>([]);
	const textTimerRef = useRef<number | null>(null);
	const completedMessageIdsRef = useRef(new Set<string>());
	const introducedInvoiceIdsRef = useRef(new Set<string>());
	const deferredPatchesRef = useRef(new Map<string, Partial<ChatMessage>[]>());

	const title = role === 'merchant' ? 'Merchant Chat' : 'Payer Checkout Chat';
	const subtitle =
		role === 'merchant'
			? 'Ask the agent to create a locked Base USDC invoice.'
			: 'Tell the agent which source chain you want to pay from.';
	const starter = useMemo(() => initialPrompt(role), [role]);

	useEffect(() => {
		if (role !== 'payer' || !initialInvoiceId) return;
		fetch(`/api/invoices/${initialInvoiceId}`)
			.then((response) => response.json())
			.then((payload) => {
				if (payload.success) {
					setInvoice(payload.invoice);
					saveInvoiceToBrowser(payload.invoice);
					setSteps((current) =>
						updateStep(
							updateStep(updateStep(current, 'parse', 'done'), 'invoice', 'done'),
							'link',
							'done',
						),
					);
					return;
				}
				const local = loadInvoiceFromBrowser(initialInvoiceId);
				if (local) {
					setInvoice(local);
					setSteps((current) =>
						updateStep(
							updateStep(updateStep(current, 'parse', 'done'), 'invoice', 'done'),
							'link',
							'done',
						),
					);
				}
			})
			.catch(() => {
				const local = loadInvoiceFromBrowser(initialInvoiceId);
				if (local) setInvoice(local);
			});
	}, [initialInvoiceId, role]);

	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: 'smooth',
		});
	}, [messages]);

	useEffect(() => {
		return () => {
			if (textTimerRef.current) window.clearInterval(textTimerRef.current);
		};
	}, []);

	const appendToAssistant = useCallback((id: string, patch: Partial<ChatMessage>) => {
		setMessages((current) =>
			current.map((message) =>
				message.id === id
					? {
							...message,
							...patch,
							content: patch.content === undefined ? message.content : patch.content,
							reasoning: patch.reasoning === undefined ? message.reasoning : patch.reasoning,
						}
					: message,
			),
		);
	}, []);

	const completeFinishedStreams = useCallback(() => {
		if (textQueueRef.current.length > 0) return;
		const doneIds = Array.from(completedMessageIdsRef.current);
		if (doneIds.length === 0) return;
		completedMessageIdsRef.current.clear();
		setMessages((current) =>
			current.map((message) =>
				doneIds.includes(message.id) ? { ...message, streaming: false } : message,
			),
		);
	}, []);

	const startTypewriter = useCallback(() => {
		if (textTimerRef.current) return;
		textTimerRef.current = window.setInterval(() => {
			const next = textQueueRef.current.shift();
			if (!next) {
				if (textTimerRef.current) {
					window.clearInterval(textTimerRef.current);
					textTimerRef.current = null;
				}
				completeFinishedStreams();
				return;
			}
			if (next.type === 'patch') {
				appendToAssistant(next.messageId, next.patch);
				return;
			}
			setMessages((current) =>
				current.map((message) =>
					message.id === next.messageId
						? { ...message, [next.field]: `${message[next.field] ?? ''}${next.token}` }
						: message,
				),
			);
		}, 18);
	}, [appendToAssistant, completeFinishedStreams]);

	const enqueueAssistantText = useCallback(
		(id: string, field: 'content' | 'reasoning', text: string) => {
			textQueueRef.current.push(
				...splitTypewriterText(text).map((token) => ({
					type: 'text' as const,
					messageId: id,
					field,
					token,
				})),
			);
			startTypewriter();
		},
		[startTypewriter],
	);

	const enqueueAssistantPatch = useCallback(
		(id: string, patch: Partial<ChatMessage>) => {
			textQueueRef.current.push({ type: 'patch', messageId: id, patch });
			startTypewriter();
		},
		[startTypewriter],
	);

	const deferAssistantPatch = useCallback((id: string, patch: Partial<ChatMessage>) => {
		const patches = deferredPatchesRef.current.get(id) ?? [];
		patches.push(patch);
		deferredPatchesRef.current.set(id, patches);
	}, []);

	const flushDeferredPatches = useCallback(
		(id: string) => {
			const patches = deferredPatchesRef.current.get(id) ?? [];
			deferredPatchesRef.current.delete(id);
			for (const patch of patches) {
				enqueueAssistantPatch(id, patch);
			}
		},
		[enqueueAssistantPatch],
	);

	const markAssistantDone = useCallback(
		(id: string) => {
			completedMessageIdsRef.current.add(id);
			completeFinishedStreams();
		},
		[completeFinishedStreams],
	);

	useEffect(() => {
		if (role !== 'payer' || !invoice) return;
		if (introducedInvoiceIdsRef.current.has(invoice.invoiceId)) return;
		introducedInvoiceIdsRef.current.add(invoice.invoiceId);

		const aiId = `ai-${++messageIdRef.current}`;
		setMessages((current) => [
			...current,
			{ id: aiId, role: 'assistant', content: '', reasoning: '', streaming: true },
		]);
		enqueueAssistantText(
			aiId,
			'content',
			[
				'你好，这是一笔 ChainCashier 付款请求。',
				'',
				`商户希望收到 **${invoice.receiveAmount} ${invoice.receiveToken} on ${invoice.receiveChain}**。`,
				`收款地址是 \`${invoice.merchantAddress}\`。`,
				'',
				'你可以直接告诉我想从哪条链支付，例如：I want to pay with USDC on Arbitrum.',
			].join('\n'),
		);
		enqueueAssistantPatch(aiId, { invoice });
		markAssistantDone(aiId);
	}, [enqueueAssistantPatch, enqueueAssistantText, invoice, markAssistantDone, role]);

	useEffect(() => {
		if (!sourceTxHash || !invoice?.invoiceId) return;
		const timer = window.setInterval(async () => {
			const response = await fetch(`/api/payments/status?invoiceId=${invoice.invoiceId}`);
			const payload = await response.json();
			if (!payload.success) return;
			setInvoice(payload.invoice);
			saveInvoiceToBrowser(payload.invoice);
			if (payload.invoice?.receipt || payload.invoice?.status === 'FAILED') {
				window.clearInterval(timer);
				const nextId = `ai-${++messageIdRef.current}`;
				setMessages((current) => [
					...current,
					{
						id: nextId,
						role: 'assistant',
						content: payload.invoice.receipt
							? '支付状态已完成，我已经生成 receipt。'
							: 'LI.FI 返回了失败或退款状态，我生成了当前证据包，方便排查。',
						invoice: payload.invoice,
						receipt: payload.invoice.receipt,
					},
				]);
				setSteps((current) =>
					payload.invoice.receipt
						? updateStep(
								updateStep(current, 'status', 'done', 'LI.FI reported the route as completed.'),
								'receipt',
								'done',
								'Receipt JSON is available.',
							)
						: updateStep(current, 'status', 'failed', 'LI.FI reported failed/refunded status.'),
				);
			}
		}, 7000);
		return () => window.clearInterval(timer);
	}, [invoice?.invoiceId, sourceTxHash]);

	async function sendMessage(raw: string) {
		const text = raw.trim();
		if (!text || busy) return;
		if (!isConnected || !address) {
			openConnectModal?.();
			return;
		}
		if (role === 'payer' && !invoice) {
			setMessages((current) => [
				...current,
				{
					id: `ai-${++messageIdRef.current}`,
					role: 'assistant',
					content: '我还没有加载到账单。请确认 payment link 有效，或让商家重新生成链接。',
				},
			]);
			return;
		}

		abortRef.current?.abort();
		const abort = new AbortController();
		abortRef.current = abort;
		const userId = `user-${++messageIdRef.current}`;
		const aiId = `ai-${++messageIdRef.current}`;
		textQueueRef.current = textQueueRef.current.filter((item) => item.messageId !== aiId);
		completedMessageIdsRef.current.delete(aiId);
		deferredPatchesRef.current.delete(aiId);
		setInput('');
		setBusy(true);
		setSteps((current) =>
			role === 'merchant'
				? updateStep(initialSteps(), 'parse', 'running')
				: updateStep(current, 'source', 'running'),
		);
		setMessages((current) => [
			...current,
			{ id: userId, role: 'user', content: text },
			{ id: aiId, role: 'assistant', content: '', reasoning: '', streaming: true },
		]);

		try {
			const response = await fetch('/api/chaincashier/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role, message: text, address, invoice }),
				signal: abort.signal,
			});
			if (!response.ok || !response.body) {
				throw new Error(`Request failed with status ${response.status}`);
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
					const line = event.split('\n').find((item) => item.startsWith('data: '));
					if (!line) continue;
					const payload = JSON.parse(line.slice(6)) as StreamPayload;

					if (payload.type === 'thinking') {
						enqueueAssistantText(aiId, 'reasoning', payload.content);
					}
					if (payload.type === 'response') {
						enqueueAssistantText(aiId, 'content', payload.content);
					}
					if (payload.type === 'invoice') {
						setInvoice(payload.invoice);
						saveInvoiceToBrowser(payload.invoice);
						deferAssistantPatch(aiId, { invoice: payload.invoice });
						setSteps((current) =>
							updateStep(
								updateStep(
									updateStep(current, 'parse', 'done', 'Invoice terms were extracted.'),
									'invoice',
									'done',
									`${payload.invoice.receiveAmount} USDC on Base is locked.`,
								),
								'link',
								'done',
								payload.invoice.paymentLink,
							),
						);
					}
					if (payload.type === 'payer_source') {
						setSource(payload.source);
						deferAssistantPatch(aiId, { source: payload.source });
						setSteps((current) =>
							updateStep(
								updateStep(current, 'source', 'done', payload.source.label),
								'quote',
								'running',
							),
						);
					}
					if (payload.type === 'quote_request') {
						setSteps((current) => updateStep(current, 'quote', 'running', 'Requesting LI.FI quote/toAmount.'));
					}
					if (payload.type === 'quote') {
						deferAssistantPatch(aiId, { quote: payload.quote, rawQuote: payload.rawQuote });
						setSteps((current) =>
							updateStep(
								updateStep(current, 'quote', 'done', payload.quote.routeSummary),
								'explain',
								'done',
								'Payer covers cross-chain cost and confirms only in wallet.',
							),
						);
					}
					if (payload.type === 'error') {
						enqueueAssistantText(aiId, 'content', payload.content);
						setSteps((current) => failRunningStep(current, payload.content));
					}
					if (payload.type === 'done') {
						flushDeferredPatches(aiId);
						markAssistantDone(aiId);
					}
				}
			}
		} catch (caught) {
			if (!abort.signal.aborted) {
				const message = caught instanceof Error ? caught.message : '请求失败，请重试。';
				enqueueAssistantText(aiId, 'content', message);
				setSteps((current) => failRunningStep(current, message));
			}
		} finally {
			setBusy(false);
			flushDeferredPatches(aiId);
			markAssistantDone(aiId);
		}
	}

	async function executePayment(targetQuote: PaymentQuoteSummary) {
		if (!invoice || !source || !walletClient || !publicClient || !address) {
			openConnectModal?.();
			return;
		}
		if (!targetQuote.transactionRequest) return;

		setPaying(true);
		setSteps((current) => updateStep(current, 'wallet', 'running'));
		try {
			if (chainId !== source.chainId) {
				await switchChainAsync({ chainId: source.chainId });
			}
			if (targetQuote.approvalAddress && BigInt(targetQuote.estimatedFromAmount) > BigInt(0)) {
				const approvalHash = await walletClient.writeContract({
					address: source.tokenAddress,
					abi: erc20Abi,
					functionName: 'approve',
					args: [targetQuote.approvalAddress, BigInt(targetQuote.estimatedFromAmount)],
					account: address,
					chain: undefined,
				});
				await publicClient.waitForTransactionReceipt({ hash: approvalHash });
			}
			const hash = await walletClient.sendTransaction({
				account: address,
				to: targetQuote.transactionRequest.to,
				data: targetQuote.transactionRequest.data,
				value: BigInt(targetQuote.transactionRequest.value ?? '0'),
				chain: undefined,
			});
			setSourceTxHash(hash);
			const submit = await fetch('/api/payments/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					invoiceId: invoice.invoiceId,
					payerAddress: address,
					sourceTxHash: hash,
				}),
			});
			const payload = await submit.json();
			if (payload.success) {
				setInvoice(payload.invoice);
				saveInvoiceToBrowser(payload.invoice);
			}
			setSteps((current) =>
				updateStep(
					updateStep(
						updateStep(current, 'wallet', 'done', 'Payer confirmed in wallet.'),
						'submitted',
						'done',
						`Source transaction saved: ${hash}`,
					),
					'status',
					'running',
				),
			);
			setMessages((current) => [
				...current,
				{
					id: `ai-${++messageIdRef.current}`,
					role: 'assistant',
					content: `钱包交易已提交，sourceTxHash：\`${hash}\`\n\n我会继续轮询 LI.FI status，完成后生成 receipt。`,
				},
			]);
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : '钱包交易失败。';
			setSteps((current) => updateStep(current, 'wallet', 'failed', message));
			setMessages((current) => [
				...current,
				{ id: `ai-${++messageIdRef.current}`, role: 'assistant', content: message },
			]);
		} finally {
			setPaying(false);
		}
	}

	async function generateReceiptPackage() {
		if (!invoice) return;
		const response = await fetch('/api/receipts/generate', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ invoiceId: invoice.invoiceId }),
		});
		const payload = await response.json();
		if (payload.success) {
			setInvoice(payload.invoice);
			saveInvoiceToBrowser(payload.invoice);
			setSteps((current) => updateStep(current, 'receipt', 'done', 'Receipt and support package are available.'));
			setMessages((current) => [
				...current,
				{
					id: `ai-${++messageIdRef.current}`,
					role: 'assistant',
					content: '我已基于当前 invoice evidence 生成 receipt 和 support package。',
					receipt: payload.receipt,
					supportPackage: payload.supportPackage,
				},
			]);
		}
	}

	return (
		<main className='flex min-h-screen flex-col bg-[#f7f8f3] text-slate-950'>
			<header className='border-b border-slate-200 bg-white/90 backdrop-blur'>
				<div className='mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4'>
					<div>
						<div className='text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700'>ChainCashier</div>
						<h1 className='text-xl font-semibold'>{title}</h1>
						<p className='text-sm text-slate-500'>{subtitle}</p>
					</div>
					<WalletButton />
				</div>
			</header>

			<div className='mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_340px]'>
				<section className='flex min-h-[70vh] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/55'>
					<div
						ref={scrollRef}
						className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-5'
					>
						{messages.length === 0 ? (
							<div className='mx-auto mt-16 w-full max-w-2xl text-center'>
								<h2 className='text-2xl font-semibold'>
									{role === 'merchant' ? '创建跨链收款账单' : '用你的钱包完成跨链付款'}
								</h2>
								<p className='mt-3 text-slate-600'>{starter}</p>
								<button
									type='button'
									onClick={() => setInput(starter)}
									className='mt-5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700'
								>
									填入示例
								</button>
							</div>
						) : null}

						{messages.map((message) => (
							<div
								key={message.id}
								className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
							>
								<div
									className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
										message.role === 'user'
											? 'bg-slate-950 text-white'
											: 'border border-slate-200 bg-white text-slate-950'
									}`}
								>
									{message.reasoning ? (
										<details className='mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600'>
											<summary className='cursor-pointer font-medium'>Thinking / tool trace</summary>
											<pre className='mt-2 whitespace-pre-wrap'>{message.reasoning}</pre>
										</details>
									) : null}
									<Markdown text={message.content || (message.streaming ? '...' : '')} />
									{message.invoice ? <InvoiceCard invoice={message.invoice} /> : null}
									{message.source ? (
										<div className='mt-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800'>
											<CheckCircle2 className='h-4 w-4' />
											{message.source.label}
										</div>
									) : null}
									{message.quote ? (
										<QuoteCard
											quote={message.quote}
											disabled={paying}
											onPay={() => void executePayment(message.quote as PaymentQuoteSummary)}
										/>
									) : null}
									{message.receipt || message.supportPackage ? (
										<ReceiptCard value={{ receipt: message.receipt, supportPackage: message.supportPackage }} />
									) : null}
									{message.streaming ? (
										<div className='mt-2 inline-flex items-center gap-2 text-xs text-slate-500'>
											<CircleDashed className='h-3 w-3' />
											streaming
										</div>
									) : null}
								</div>
							</div>
						))}
					</div>

					<div className='border-t border-slate-200 bg-white/90 px-4 py-4 sm:px-5'>
						{role === 'payer' && invoice ? (
							<div className='mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600'>
								<span>Invoice: {invoice.invoiceId} | Merchant receives {invoice.receiveAmount} USDC on Base</span>
								<button
									type='button'
									onClick={generateReceiptPackage}
									className='inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-medium'
								>
									<ReceiptText className='h-3 w-3' />
									Generate receipt package
								</button>
							</div>
						) : null}
						<div className='intentlens-composer-shell rounded-[20px] p-1'>
							<ChatSender
								value={input}
								onChangeAction={setInput}
								onSubmitAction={sendMessage}
								loading={busy}
								onCancelAction={() => {
									abortRef.current?.abort();
									setBusy(false);
								}}
							/>
						</div>
						<div className='mt-2 flex items-center gap-2 text-xs text-slate-500'>
							<Copy className='h-3 w-3' />
							Agent plans. User signs. Wallet executes. LI.FI routes. App tracks.
						</div>
					</div>
				</section>

				<FlowRecorder steps={steps} />
			</div>
		</main>
	);
}
