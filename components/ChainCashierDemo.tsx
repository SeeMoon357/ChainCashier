'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	AlertTriangle,
	CheckCircle2,
	CircleDashed,
	ClipboardList,
	ExternalLink,
	FileJson,
	Link2,
	ReceiptText,
	Send,
	Wallet,
} from 'lucide-react';
import { parseAbi } from 'viem';
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import WalletButton from '@/components/WalletConnect';
import type {
	Invoice,
	PaymentQuoteSummary,
	SupportPackage,
} from '@/lib/chainCashier';
import { getChainCashierWalletChain } from '@/lib/chainCashierWalletChains';

type FlowStep = {
	key: string;
	title: string;
	status: 'pending' | 'running' | 'done' | 'failed';
	note: string;
};

type QuoteResponse = {
	success: boolean;
	invoice?: Invoice;
	quote?: PaymentQuoteSummary;
	rawQuote?: unknown;
	error?: string;
};

const SOURCE_OPTIONS = [
	{
		label: 'Arbitrum USDC',
		chainId: 42161,
		tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
	},
	{
		label: 'Optimism USDC',
		chainId: 10,
		tokenAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
	},
	{
		label: 'Polygon USDC',
		chainId: 137,
		tokenAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
	},
];

const erc20Abi = parseAbi([
	'function approve(address spender, uint256 amount) returns (bool)',
]);

function invoiceStorageKey(invoiceId: string): string {
	return `chaincashier:invoice:${invoiceId}`;
}

function saveInvoiceToBrowser(invoice: Invoice) {
	window.localStorage.setItem(invoiceStorageKey(invoice.invoiceId), JSON.stringify(invoice));
	window.localStorage.setItem('chaincashier:latestInvoiceId', invoice.invoiceId);
}

function loadInvoiceFromBrowser(invoiceId: string): Invoice | null {
	const raw = window.localStorage.getItem(invoiceStorageKey(invoiceId));
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as Invoice;
	} catch {
		return null;
	}
}

function initialSteps(): FlowStep[] {
	return [
		{
			key: 'parse',
			title: 'Merchant Goal Parsed',
			status: 'pending',
			note: 'GLM-5.1 turns merchant language into a locked invoice.',
		},
		{
			key: 'invoice',
			title: 'Invoice Created',
			status: 'pending',
			note: 'Merchant address, Base USDC target, amount, and fee policy are locked.',
		},
		{
			key: 'link',
			title: 'Payment Link Generated',
			status: 'pending',
			note: 'The payer can open a checkout link for this invoice.',
		},
		{
			key: 'source',
			title: 'Payer Source Selected',
			status: 'pending',
			note: 'Payer chooses the source chain and token.',
		},
		{
			key: 'quote',
			title: 'LI.FI Quote Requested',
			status: 'pending',
			note: 'The app asks LI.FI for a toAmount quote so merchant receives exact Base USDC.',
		},
		{
			key: 'explain',
			title: 'Fee & Risk Explained',
			status: 'pending',
			note: 'Agent explains payer cost, fee policy, and wallet confirmation boundary.',
		},
		{
			key: 'wallet',
			title: 'Wallet Confirmation Required',
			status: 'pending',
			note: 'Funds move only after payer signs in their wallet.',
		},
		{
			key: 'submitted',
			title: 'Payment Submitted',
			status: 'pending',
			note: 'The source transaction hash is saved to the invoice.',
		},
		{
			key: 'status',
			title: 'LI.FI Status Tracking',
			status: 'pending',
			note: 'The app polls LI.FI status until paid, failed, or refunded.',
		},
		{
			key: 'receipt',
			title: 'Receipt Generated',
			status: 'pending',
			note: 'Receipt JSON and support package are generated from the evidence.',
		},
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

function formatUnits(value?: string): string {
	if (!value || !/^\d+$/.test(value)) {
		return 'n/a';
	}

	const units = BigInt(value);
	const decimals = BigInt(1_000_000);
	const whole = units / decimals;
	const fraction = (units % decimals).toString().padStart(6, '0').replace(/0+$/, '');
	return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function StatusIcon({ status }: { status: FlowStep['status'] }) {
	if (status === 'done') {
		return <CheckCircle2 className='h-4 w-4 text-emerald-600' />;
	}
	if (status === 'failed') {
		return <AlertTriangle className='h-4 w-4 text-rose-600' />;
	}
	return <CircleDashed className={status === 'running' ? 'h-4 w-4 text-sky-600' : 'h-4 w-4 text-slate-400'} />;
}

function JsonBlock({ value }: { value: unknown }) {
	return (
		<pre className='max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100'>
			{JSON.stringify(value, null, 2)}
		</pre>
	);
}

export default function ChainCashierDemo({
	initialInvoiceId,
}: {
	initialInvoiceId?: string;
}) {
	const { address, isConnected, chainId } = useAccount();
	const { data: walletClient } = useWalletClient();
	const publicClient = usePublicClient();
	const { switchChainAsync } = useSwitchChain();
	const [merchantPrompt, setMerchantPrompt] = useState(
		'Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.',
	);
	const [manualMerchant, setManualMerchant] = useState('');
	const [invoice, setInvoice] = useState<Invoice | null>(null);
	const [quote, setQuote] = useState<PaymentQuoteSummary | null>(null);
	const [rawQuote, setRawQuote] = useState<unknown>(null);
	const [receiptResponse, setReceiptResponse] = useState<unknown>(null);
	const [supportPackage, setSupportPackage] = useState<SupportPackage | null>(null);
	const [selectedSource, setSelectedSource] = useState(SOURCE_OPTIONS[0]);
	const [steps, setSteps] = useState<FlowStep[]>(initialSteps);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);

	const merchantAddress = manualMerchant || address || '';
	const paymentUrl = invoice?.paymentLink ?? '';
	const canCreate = Boolean(merchantAddress);

	useEffect(() => {
		if (!initialInvoiceId) {
			return;
		}

		fetch(`/api/invoices/${initialInvoiceId}`)
			.then((response) => response.json())
			.then((payload) => {
				if (payload.success) {
					setInvoice(payload.invoice);
					saveInvoiceToBrowser(payload.invoice);
					setSteps((current) =>
						updateStep(
							updateStep(
								updateStep(current, 'parse', 'done'),
								'invoice',
								'done',
							),
							'link',
							'done',
						),
					);
					return;
				}

				const browserInvoice = loadInvoiceFromBrowser(initialInvoiceId);
				if (browserInvoice) {
					setInvoice(browserInvoice);
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
				const browserInvoice = loadInvoiceFromBrowser(initialInvoiceId);
				if (browserInvoice) {
					setInvoice(browserInvoice);
					setSteps((current) =>
						updateStep(
							updateStep(updateStep(current, 'parse', 'done'), 'invoice', 'done'),
							'link',
							'done',
						),
					);
				}
			});
	}, [initialInvoiceId]);

	useEffect(() => {
		if (!invoice?.invoiceId || !sourceTxHash) {
			return;
		}

		const timer = window.setInterval(async () => {
			const response = await fetch(`/api/payments/status?invoiceId=${invoice.invoiceId}`);
			const payload = await response.json();
			if (payload.success) {
				setInvoice(payload.invoice);
				saveInvoiceToBrowser(payload.invoice);
				if (payload.invoice?.receipt) {
					setSteps((current) =>
						updateStep(
							updateStep(current, 'status', 'done', 'LI.FI reported the route as completed.'),
							'receipt',
							'done',
							'Receipt JSON is available.',
						),
					);
					window.clearInterval(timer);
				}
				if (payload.invoice?.status === 'FAILED') {
					setSteps((current) =>
						updateStep(current, 'status', 'failed', 'LI.FI reported failed/refunded status.'),
					);
					window.clearInterval(timer);
				}
			}
		}, 7_000);

		return () => window.clearInterval(timer);
	}, [invoice?.invoiceId, sourceTxHash]);

	const costSummary = useMemo(() => {
		if (!quote || !invoice) {
			return null;
		}

		return {
			merchantReceives: `${invoice.receiveAmount} ${invoice.receiveToken} on ${invoice.receiveChain}`,
			payerPaysEstimated: `${formatUnits(quote.estimatedFromAmount)} USDC`,
			minimumReceived: `${formatUnits(quote.toAmountMin ?? quote.targetToAmount)} USDC`,
			feesUsd: quote.estimatedFeesUsd ?? 'n/a',
			routeTool: quote.toolName ?? quote.tool ?? 'LI.FI',
			routeDuration: quote.executionDuration == null ? 'n/a' : `${quote.executionDuration}s`,
			feePolicy: invoice.feePolicy,
		};
	}, [invoice, quote]);

	async function createInvoice() {
		setBusy('create');
		setError(null);
		setSteps(initialSteps());
		try {
			setSteps((current) => updateStep(current, 'parse', 'running'));
			const agentResponse = await fetch('/api/chaincashier/agent', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message: merchantPrompt }),
			});
			const agentPayload = await agentResponse.json();
			if (!agentPayload.success) {
				throw new Error(agentPayload.error ?? 'Agent failed to parse invoice.');
			}
			setSteps((current) =>
				updateStep(current, 'parse', 'done', 'GLM-5.1 produced a structured invoice plan.'),
			);
			setSteps((current) => updateStep(current, 'invoice', 'running'));
			const invoiceResponse = await fetch('/api/invoices', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					merchantAddress,
					agentOutput: agentPayload.data,
				}),
			});
			const invoicePayload = await invoiceResponse.json();
			if (!invoicePayload.success) {
				throw new Error(invoicePayload.error ?? 'Invoice creation failed.');
			}

			setInvoice(invoicePayload.invoice);
			saveInvoiceToBrowser(invoicePayload.invoice);
			setQuote(null);
			setRawQuote(null);
			setReceiptResponse(null);
			setSupportPackage(null);
			setSourceTxHash(null);
			setSteps((current) =>
				updateStep(
					updateStep(current, 'invoice', 'done', 'Invoice terms are locked.'),
					'link',
					'done',
					'Payment link is ready.',
				),
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Failed to create invoice.');
			setSteps((current) => updateStep(current, 'invoice', 'failed'));
		} finally {
			setBusy(null);
		}
	}

	async function requestQuote() {
		if (!invoice || !address) {
			setError('Connect payer wallet and create/load an invoice first.');
			return;
		}

		setBusy('quote');
		setError(null);
		try {
			setSteps((current) => updateStep(current, 'source', 'done', selectedSource.label));
			setSteps((current) => updateStep(current, 'quote', 'running'));
			const response = await fetch('/api/payments/quote', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					invoiceId: invoice.invoiceId,
					payerAddress: address,
					sourceChainId: selectedSource.chainId,
					sourceTokenAddress: selectedSource.tokenAddress,
					invoice,
				}),
			});
			const payload = (await response.json()) as QuoteResponse;
			if (!payload.success || !payload.quote) {
				throw new Error(payload.error ?? 'LI.FI quote failed.');
			}

			const nextInvoice = payload.invoice ?? invoice;
			setInvoice(nextInvoice);
			saveInvoiceToBrowser(nextInvoice);
			setQuote(payload.quote);
			setRawQuote(payload.rawQuote);
			setSteps((current) =>
				updateStep(
					updateStep(current, 'quote', 'done', payload.quote?.routeSummary),
					'explain',
					'done',
					'Payer covers bridge, gas, route fee, and slippage.',
				),
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Failed to request quote.');
			setSteps((current) => updateStep(current, 'quote', 'failed'));
		} finally {
			setBusy(null);
		}
	}

	async function executePayment() {
		if (!invoice || !quote?.transactionRequest || !walletClient || !publicClient || !address) {
			setError('Wallet and executable LI.FI quote are required.');
			return;
		}

		setBusy('execute');
		setError(null);
		try {
			setSteps((current) => updateStep(current, 'wallet', 'running'));
			const sourceChain = getChainCashierWalletChain(selectedSource.chainId);
			if (!sourceChain) {
				throw new Error(`Unsupported payer source chain: ${selectedSource.chainId}`);
			}
			if (chainId !== selectedSource.chainId) {
				await switchChainAsync({ chainId: selectedSource.chainId });
			}

			if (quote.approvalAddress && BigInt(quote.estimatedFromAmount) > BigInt(0)) {
				const approvalHash = await walletClient.writeContract({
					address: selectedSource.tokenAddress as `0x${string}`,
					abi: erc20Abi,
					functionName: 'approve',
					args: [quote.approvalAddress, BigInt(quote.estimatedFromAmount)],
					chain: sourceChain,
					account: address,
				});
				await publicClient.waitForTransactionReceipt({ hash: approvalHash });
			}

			const hash = await walletClient.sendTransaction({
				account: address,
				to: quote.transactionRequest.to,
				data: quote.transactionRequest.data,
				value: BigInt(quote.transactionRequest.value ?? '0'),
				chain: sourceChain,
			});
			setSourceTxHash(hash);
			setSteps((current) =>
				updateStep(
					updateStep(current, 'wallet', 'done', 'Payer confirmed in wallet.'),
					'submitted',
					'done',
					`Source transaction saved: ${hash}`,
				),
			);
			setSteps((current) => updateStep(current, 'status', 'running'));
			const submitResponse = await fetch('/api/payments/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					invoiceId: invoice.invoiceId,
					payerAddress: address,
					sourceTxHash: hash,
				}),
			});
			const payload = await submitResponse.json();
			if (payload.success) {
				setInvoice(payload.invoice);
				saveInvoiceToBrowser(payload.invoice);
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Wallet execution failed.');
			setSteps((current) => updateStep(current, 'wallet', 'failed'));
		} finally {
			setBusy(null);
		}
	}

	async function generateReceiptPackage() {
		if (!invoice) {
			return;
		}
		setBusy('receipt');
		setError(null);
		try {
			const response = await fetch('/api/receipts/generate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ invoiceId: invoice.invoiceId }),
			});
			const payload = await response.json();
			if (!payload.success) {
				throw new Error(payload.error ?? 'Receipt generation failed.');
			}
			setInvoice(payload.invoice);
			saveInvoiceToBrowser(payload.invoice);
			setReceiptResponse(payload.receipt);
			setSupportPackage(payload.supportPackage);
			setSteps((current) => updateStep(current, 'receipt', 'done'));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Receipt generation failed.');
		} finally {
			setBusy(null);
		}
	}

	return (
		<main className='min-h-screen bg-[#f6f7f2] text-slate-950'>
			<header className='border-b border-slate-200 bg-white/85 backdrop-blur'>
				<div className='mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4'>
					<div>
						<div className='text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700'>
							ChainCashier
						</div>
						<h1 className='mt-1 text-2xl font-semibold'>AI Cross-chain Checkout Agent</h1>
					</div>
					<WalletButton />
				</div>
			</header>

			<div className='mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[1fr_1fr_380px]'>
				<section className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
					<div className='flex items-center gap-2 text-sm font-semibold text-slate-700'>
						<ClipboardList className='h-4 w-4' />
						Merchant
					</div>
					<textarea
						value={merchantPrompt}
						onChange={(event) => setMerchantPrompt(event.target.value)}
						className='mt-3 min-h-28 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600'
					/>
					<input
						value={manualMerchant}
						onChange={(event) => setManualMerchant(event.target.value)}
						placeholder={address ? `Connected: ${address}` : 'Merchant address, or connect wallet'}
						className='mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600'
					/>
					<button
						type='button'
						onClick={createInvoice}
						disabled={!canCreate || busy === 'create'}
						className='mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300'
					>
						<Send className='h-4 w-4' />
						Create Invoice
					</button>

					{invoice ? (
						<div className='mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm'>
							<div className='font-semibold'>{invoice.invoiceId}</div>
							<div>Merchant receives: {invoice.receiveAmount} {invoice.receiveToken} on {invoice.receiveChain}</div>
							<div>Fee policy: {invoice.feePolicy}</div>
							<div>Status: {invoice.status}</div>
							<a
								href={paymentUrl}
								className='inline-flex items-center gap-1 break-all text-emerald-700 underline'
							>
								<Link2 className='h-4 w-4' />
								{paymentUrl}
							</a>
						</div>
					) : null}
				</section>

				<section className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
					<div className='flex items-center gap-2 text-sm font-semibold text-slate-700'>
						<Wallet className='h-4 w-4' />
						Payer Checkout
					</div>
					<div className='mt-3 grid gap-3 text-sm'>
						<label className='grid gap-1'>
							<span className='text-xs font-semibold text-slate-500'>Source asset</span>
							<select
								value={selectedSource.chainId}
								onChange={(event) => {
									const next = SOURCE_OPTIONS.find(
										(option) => option.chainId === Number(event.target.value),
									);
									if (next) setSelectedSource(next);
								}}
								className='rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600'
							>
								{SOURCE_OPTIONS.map((option) => (
									<option
										key={option.chainId}
										value={option.chainId}
									>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<button
							type='button'
							onClick={requestQuote}
							disabled={!invoice || !isConnected || busy === 'quote'}
							className='inline-flex items-center justify-center gap-2 rounded-md border border-emerald-700 px-4 py-2 font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400'
						>
							Request LI.FI Quote
						</button>
					</div>

					{costSummary ? (
						<div className='mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950'>
							<div>Merchant receives: {costSummary.merchantReceives}</div>
							<div>Payer pays estimated: {costSummary.payerPaysEstimated}</div>
							<div>Minimum received: {costSummary.minimumReceived}</div>
							<div>Estimated fees USD: {costSummary.feesUsd}</div>
							<div>Route tool: {costSummary.routeTool}</div>
							<div>Estimated route time: {costSummary.routeDuration}</div>
							<div>Fee policy: payer covers cross-chain cost</div>
						</div>
					) : null}

					<button
						type='button'
						onClick={executePayment}
						disabled={!quote?.transactionRequest || !isConnected || busy === 'execute'}
						className='mt-3 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300'
					>
						<Wallet className='h-4 w-4' />
						Approve & Pay With Wallet
					</button>

					{sourceTxHash ? (
						<div className='mt-3 break-all rounded-md border border-slate-200 bg-slate-50 p-3 text-xs'>
							Source tx: {sourceTxHash}
						</div>
					) : null}

					<button
						type='button'
						onClick={generateReceiptPackage}
						disabled={!invoice || busy === 'receipt'}
						className='mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400'
					>
						<ReceiptText className='h-4 w-4' />
						Generate Receipt / Support Package
					</button>
				</section>

				<aside className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
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
			</div>

			<div className='mx-auto grid max-w-7xl gap-4 px-5 pb-6 lg:grid-cols-2'>
				{error ? (
					<div className='rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900'>
						{error}
					</div>
				) : null}
				{quote ? (
					<section className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
						<div className='mb-3 flex items-center gap-2 text-sm font-semibold'>
							<ExternalLink className='h-4 w-4' />
							Quote Summary
						</div>
						<JsonBlock value={quote} />
					</section>
				) : null}
				{rawQuote ? (
					<section className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
						<div className='mb-3 flex items-center gap-2 text-sm font-semibold'>
							<FileJson className='h-4 w-4' />
							Raw LI.FI Data
						</div>
						<JsonBlock value={rawQuote} />
					</section>
				) : null}
				{receiptResponse || supportPackage ? (
					<section className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2'>
						<div className='mb-3 flex items-center gap-2 text-sm font-semibold'>
							<ReceiptText className='h-4 w-4' />
							Receipt & Support Package
						</div>
						<JsonBlock value={{ receipt: receiptResponse ?? invoice?.receipt, supportPackage }} />
					</section>
				) : null}
			</div>
		</main>
	);
}
