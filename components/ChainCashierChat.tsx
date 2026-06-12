'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseAbi } from 'viem';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import { CheckCircle2, CircleDashed, Copy, ExternalLink, ReceiptText, Wallet } from 'lucide-react';
import WalletButton from './WalletConnect';
import type { Invoice, PaymentQuoteSummary, SupportPackage } from '@/lib/chainCashier';
import type { PayerSourceOption } from '@/lib/chainCashierChat';

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

type StreamPayload =
	| { type: 'thinking'; content: string }
	| { type: 'response'; content: string }
	| { type: 'invoice'; invoice: Invoice }
	| { type: 'payer_source'; source: PayerSourceOption }
	| { type: 'quote'; quote: PaymentQuoteSummary; rawQuote?: unknown }
	| { type: 'error'; content: string }
	| { type: 'done' };

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
	const [busy, setBusy] = useState(false);
	const [paying, setPaying] = useState(false);
	const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const messageIdRef = useRef(0);

	const title = role === 'merchant' ? 'Merchant Chat' : 'Payer Checkout Chat';
	const subtitle =
		role === 'merchant'
			? 'Ask the agent to create a locked Base USDC invoice.'
			: 'Tell the agent which source chain you want to pay from.';

	useEffect(() => {
		if (role !== 'payer' || !initialInvoiceId) return;
		fetch(`/api/invoices/${initialInvoiceId}`)
			.then((response) => response.json())
			.then((payload) => {
				if (payload.success) {
					setInvoice(payload.invoice);
					saveInvoiceToBrowser(payload.invoice);
					return;
				}
				const local = loadInvoiceFromBrowser(initialInvoiceId);
				if (local) setInvoice(local);
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
			}
		}, 7000);
		return () => window.clearInterval(timer);
	}, [invoice?.invoiceId, sourceTxHash]);

	const appendToAssistant = useCallback((id: string, patch: Partial<ChatMessage>) => {
		setMessages((current) =>
			current.map((message) =>
				message.id === id
					? {
							...message,
							...patch,
							content: patch.content === undefined ? message.content : patch.content,
							reasoning:
								patch.reasoning === undefined ? message.reasoning : patch.reasoning,
						}
					: message,
			),
		);
	}, []);

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
					content: '我还没有加载到这个账单。请确认 payment link 有效，或让商户重新生成链接。',
				},
			]);
			return;
		}

		abortRef.current?.abort();
		const abort = new AbortController();
		abortRef.current = abort;
		const userId = `user-${++messageIdRef.current}`;
		const aiId = `ai-${++messageIdRef.current}`;
		setInput('');
		setBusy(true);
		setMessages((current) => [
			...current,
			{ id: userId, role: 'user', content: text },
			{ id: aiId, role: 'assistant', content: '', reasoning: '', streaming: true },
		]);

		try {
			const response = await fetch('/api/chaincashier/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					role,
					message: text,
					address,
					invoice,
				}),
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
						appendToAssistant(aiId, {
							reasoning: `${messages.find((item) => item.id === aiId)?.reasoning ?? ''}${payload.content}`,
						});
						setMessages((current) =>
							current.map((item) =>
								item.id === aiId
									? { ...item, reasoning: `${item.reasoning ?? ''}${payload.content}` }
									: item,
							),
						);
					}
					if (payload.type === 'response') {
						setMessages((current) =>
							current.map((item) =>
								item.id === aiId
									? { ...item, content: `${item.content}${payload.content}` }
									: item,
							),
						);
					}
					if (payload.type === 'invoice') {
						setInvoice(payload.invoice);
						saveInvoiceToBrowser(payload.invoice);
						appendToAssistant(aiId, { invoice: payload.invoice });
					}
					if (payload.type === 'payer_source') {
						setSource(payload.source);
						appendToAssistant(aiId, { source: payload.source });
					}
					if (payload.type === 'quote') {
						appendToAssistant(aiId, {
							quote: payload.quote,
							rawQuote: payload.rawQuote,
						});
					}
					if (payload.type === 'error') {
						appendToAssistant(aiId, { content: payload.content });
					}
					if (payload.type === 'done') {
						appendToAssistant(aiId, { streaming: false });
					}
				}
			}
		} catch (caught) {
			if (!abort.signal.aborted) {
				appendToAssistant(aiId, {
					content: caught instanceof Error ? caught.message : '请求失败，请重试。',
				});
			}
		} finally {
			setBusy(false);
			appendToAssistant(aiId, { streaming: false });
		}
	}

	async function executePayment(targetQuote: PaymentQuoteSummary) {
		if (!invoice || !source || !walletClient || !publicClient || !address) {
			openConnectModal?.();
			return;
		}
		if (!targetQuote.transactionRequest) return;

		setPaying(true);
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
			setMessages((current) => [
				...current,
				{
					id: `ai-${++messageIdRef.current}`,
					role: 'assistant',
					content: `钱包交易已提交，sourceTxHash：\`${hash}\`\n\n我会继续轮询 LI.FI status，完成后生成 receipt。`,
				},
			]);
		} catch (caught) {
			setMessages((current) => [
				...current,
				{
					id: `ai-${++messageIdRef.current}`,
					role: 'assistant',
					content: caught instanceof Error ? caught.message : '钱包交易失败。',
				},
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

	const starter = useMemo(() => initialPrompt(role), [role]);

	return (
		<main className='flex min-h-screen flex-col bg-[#f7f8f3] text-slate-950'>
			<header className='border-b border-slate-200 bg-white/90 backdrop-blur'>
				<div className='mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4'>
					<div>
						<div className='text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700'>ChainCashier</div>
						<h1 className='text-xl font-semibold'>{title}</h1>
						<p className='text-sm text-slate-500'>{subtitle}</p>
					</div>
					<WalletButton />
				</div>
			</header>

			<div
				ref={scrollRef}
				className='mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 overflow-y-auto px-5 py-5'
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

			<div className='border-t border-slate-200 bg-white/90 px-5 py-4'>
				<div className='mx-auto max-w-5xl'>
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
			</div>
		</main>
	);
}
