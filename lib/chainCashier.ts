import { keccak256, parseUnits, stringToHex } from 'viem';
import {
	CHAINCASHIER_USDC_CHAINS,
	getChainCashierChainLabel,
	normalizeChainCashierChainKey,
} from './chainCashierChains';
import {
	resolveLifiRouteStatus,
	type LifiStatusResponse,
} from './lifiStatus';

export type InvoiceStatus =
	| 'CREATED'
	| 'QUOTE_READY'
	| 'PAYMENT_SUBMITTED'
	| 'PAYMENT_PENDING'
	| 'PAID'
	| 'RECEIPT_GENERATED'
	| 'PROOF_REGISTERED'
	| 'EXPIRED'
	| 'FAILED';

export type FeePolicy = 'PAYER_PAYS';

export type PaymentQuoteSummary = {
	provider: 'LI.FI';
	mode: 'ROUTE_TO_AMOUNT';
	fromChainId: number;
	toChainId: number;
	fromTokenAddress: `0x${string}`;
	toTokenAddress: `0x${string}`;
	estimatedFromAmount: string;
	targetToAmount: string;
	estimatedToAmount?: string;
	toAmountMin?: string;
	estimatedFeesUsd?: string;
	approvalAddress?: `0x${string}`;
	routeSummary: string;
	transactionRequest?: {
		to: `0x${string}`;
		data: `0x${string}`;
		value?: string;
		chainId?: number;
	};
};

export type PaymentReceipt = {
	invoiceId: string;
	merchantAddress: `0x${string}`;
	payerAddress: `0x${string}`;
	receiveChain: string;
	receiveChainId: number;
	receiveToken: string;
	receiveAmount: string;
	sourceChain: string;
	sourceChainId: number;
	sourceToken: string;
	sourceTxHash?: `0x${string}`;
	destinationTxHash?: `0x${string}`;
	lifiStatus?: string;
	lifiSubstatus?: string;
	lifiExplorerLink?: string;
	feePolicy: FeePolicy;
	createdAt: number;
	receiptHash?: `0x${string}`;
};

export type Invoice = {
	invoiceId: string;
	merchantAddress: `0x${string}`;
	receiveChain: string;
	receiveChainId: number;
	receiveToken: string;
	receiveTokenAddress: `0x${string}`;
	receiveAmount: string;
	memo?: string;
	feePolicy: FeePolicy;
	createdAt: number;
	expiresAt?: number;
	status: InvoiceStatus;
	paymentLink: string;
	payerAddress?: `0x${string}`;
	sourceChain?: string;
	sourceChainId?: number;
	sourceToken?: string;
	sourceTokenAddress?: `0x${string}`;
	quote?: PaymentQuoteSummary;
	sourceTxHash?: `0x${string}`;
	destinationTxHash?: `0x${string}`;
	lifiStatus?: string;
	lifiSubstatus?: string;
	receipt?: PaymentReceipt;
	proofTxHash?: `0x${string}`;
};

export type SupportPackage = {
	invoiceId: string;
	payerAddress?: string;
	merchantAddress: string;
	sourceChain?: string;
	targetChain: string;
	sourceTxHash?: string;
	destinationTxHash?: string;
	lifiStatus?: string;
	lifiSubstatus?: string;
	issueSummary: string;
	userFriendlyExplanation: string;
	merchantViewExplanation: string;
	recommendedNextSteps: string[];
	evidence: {
		invoice: Invoice;
		receipt?: PaymentReceipt;
	};
};

type AgentInvoiceOutput = {
	invoice?: {
		receiveChain?: string;
		receiveToken?: string;
		receiveAmount?: string;
		memo?: string;
		expiresInMinutes?: number;
	};
};

type RawLifiQuote = {
	action?: {
		fromAmount?: unknown;
		toAmount?: unknown;
		fromChainId?: unknown;
		toChainId?: unknown;
		fromToken?: { address?: unknown };
		toToken?: { address?: unknown };
		toAddress?: unknown;
	};
		estimate?: {
		fromAmount?: unknown;
		toAmount?: unknown;
		toAmountMin?: unknown;
		feeCosts?: Array<{ amountUSD?: unknown }>;
		gasCosts?: Array<{ amountUSD?: unknown }>;
		executionDuration?: unknown;
		approvalAddress?: unknown;
	};
	transactionRequest?: {
		to?: unknown;
		data?: unknown;
		value?: unknown;
		chainId?: unknown;
	};
	tool?: unknown;
};

function asHexAddress(value: string, label: string): `0x${string}` {
	const trimmed = value.trim();
	if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
		throw new Error(`${label} must be a valid EVM address.`);
	}

	return trimmed as `0x${string}`;
}

function asHexHash(value: string | undefined): `0x${string}` | undefined {
	if (!value) {
		return undefined;
	}

	return value as `0x${string}`;
}

function normalizeAddress(value: string): string {
	return value.trim().toLowerCase();
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function assertSupportedUsdcInvoice(input: {
	receiveChain?: string;
	receiveToken?: string;
	receiveAmount?: string;
}) {
	const receiveChain = normalizeChainCashierChainKey(input.receiveChain);
	const receiveToken = input.receiveToken?.trim().toUpperCase() || 'USDC';
	const receiveAmount = input.receiveAmount?.trim();

	if (receiveToken !== 'USDC') {
		throw new Error('ChainCashier invoices must receive USDC.');
	}

	if (!receiveAmount || Number(receiveAmount) <= 0) {
		throw new Error('Invoice receiveAmount must be a positive USDC amount.');
	}

	return {
		receiveChain,
		receiveToken,
		receiveAmount,
		chainConfig: CHAINCASHIER_USDC_CHAINS[receiveChain],
	};
}

export function createInvoiceFromAgentOutput(input: {
	merchantAddress: string;
	origin: string;
	agentOutput: AgentInvoiceOutput;
	now?: number;
}): Invoice {
	const now = input.now ?? Date.now();
	const invoicePayload = input.agentOutput.invoice ?? {};
	const { receiveChain, receiveToken, receiveAmount, chainConfig } =
		assertSupportedUsdcInvoice({
			receiveChain: invoicePayload.receiveChain,
			receiveToken: invoicePayload.receiveToken,
			receiveAmount: invoicePayload.receiveAmount,
		});

	const invoiceId = `INV-${now}`;
	const origin = input.origin.replace(/\/$/, '');
	const expiresInMinutes = numberValue(invoicePayload.expiresInMinutes);

	return {
		invoiceId,
		merchantAddress: asHexAddress(input.merchantAddress, 'merchantAddress'),
		receiveChain,
		receiveChainId: chainConfig.chainId,
		receiveToken,
		receiveTokenAddress: chainConfig.usdcAddress,
		receiveAmount,
		memo: invoicePayload.memo,
		feePolicy: 'PAYER_PAYS',
		createdAt: now,
		expiresAt: expiresInMinutes ? now + expiresInMinutes * 60_000 : undefined,
		status: 'CREATED',
		paymentLink: `${origin}/pay/${invoiceId}`,
	};
}

export function buildPaymentQuoteRequest(input: {
	invoice: Invoice;
	payerAddress: string;
	sourceChainId: number;
	sourceTokenAddress: string;
}) {
	return {
		fromChain: input.sourceChainId,
		toChain: input.invoice.receiveChainId,
		fromToken: asHexAddress(input.sourceTokenAddress, 'sourceTokenAddress'),
		toToken: input.invoice.receiveTokenAddress,
		fromAddress: asHexAddress(input.payerAddress, 'payerAddress'),
		toAddress: input.invoice.merchantAddress,
		toAmount: parseUnits(input.invoice.receiveAmount, 6).toString(),
	};
}

export function summarizePaymentQuote(input: {
	invoice: Invoice;
	sourceChainId: number;
	sourceTokenAddress: string;
	rawQuote: RawLifiQuote;
}): PaymentQuoteSummary {
	const action = input.rawQuote.action ?? {};
	const estimate = input.rawQuote.estimate ?? {};
	const targetAddress = stringValue(action.toAddress);
	const toChainId = numberValue(action.toChainId);
	const fromChainId = numberValue(action.fromChainId);
	const toTokenAddress = stringValue(action.toToken?.address);
	const fromTokenAddress = stringValue(action.fromToken?.address);

	if (targetAddress && normalizeAddress(targetAddress) !== normalizeAddress(input.invoice.merchantAddress)) {
		throw new Error('Quote target address does not match the locked merchant address.');
	}

	if (toChainId != null && toChainId !== input.invoice.receiveChainId) {
		throw new Error('Quote target chain does not match the locked invoice chain.');
	}

	if (
		toTokenAddress &&
		normalizeAddress(toTokenAddress) !== normalizeAddress(input.invoice.receiveTokenAddress)
	) {
		throw new Error('Quote target token does not match the locked invoice token.');
	}

	const estimatedFromAmount =
		stringValue(action.fromAmount) ?? stringValue(estimate.fromAmount) ?? '0';
	const targetToAmount =
		stringValue(action.toAmount) ??
		stringValue(estimate.toAmount) ??
		parseUnits(input.invoice.receiveAmount, 6).toString();
	const feeUsd = [
		...(estimate.feeCosts ?? []),
		...(estimate.gasCosts ?? []),
	].reduce((sum, item) => {
		const value = Number(item.amountUSD ?? 0);
		return Number.isFinite(value) ? sum + value : sum;
	}, 0);

	return {
		provider: 'LI.FI',
		mode: 'ROUTE_TO_AMOUNT',
		fromChainId: fromChainId ?? input.sourceChainId,
		toChainId: toChainId ?? input.invoice.receiveChainId,
		fromTokenAddress:
			(fromTokenAddress ?? input.sourceTokenAddress) as `0x${string}`,
		toTokenAddress: input.invoice.receiveTokenAddress,
		estimatedFromAmount,
		targetToAmount,
		estimatedToAmount: stringValue(estimate.toAmount),
		toAmountMin: stringValue(estimate.toAmountMin),
		estimatedFeesUsd: feeUsd.toFixed(2),
		approvalAddress: stringValue(estimate.approvalAddress) as
			| `0x${string}`
			| undefined,
		routeSummary: `${getChainCashierChainLabel(input.sourceChainId)} USDC -> ${getChainCashierChainLabel(input.invoice.receiveChainId)} USDC via ${stringValue(input.rawQuote.tool) ?? 'LI.FI'}`,
		transactionRequest:
			typeof input.rawQuote.transactionRequest?.to === 'string' &&
			typeof input.rawQuote.transactionRequest?.data === 'string'
				? {
						to: input.rawQuote.transactionRequest.to as `0x${string}`,
						data: input.rawQuote.transactionRequest.data as `0x${string}`,
						value: stringValue(input.rawQuote.transactionRequest.value),
						chainId: numberValue(input.rawQuote.transactionRequest.chainId),
					}
				: undefined,
	};
}

export function generateReceipt(input: {
	invoice: Invoice;
	destinationTxHash?: string;
	lifiStatus?: string;
	lifiSubstatus?: string | null;
	now?: number;
}): PaymentReceipt {
	if (!input.invoice.payerAddress) {
		throw new Error('Cannot generate receipt without payerAddress.');
	}

	const receipt: PaymentReceipt = {
		invoiceId: input.invoice.invoiceId,
		merchantAddress: input.invoice.merchantAddress,
		payerAddress: input.invoice.payerAddress,
		receiveChain: input.invoice.receiveChain,
		receiveChainId: input.invoice.receiveChainId,
		receiveToken: input.invoice.receiveToken,
		receiveAmount: input.invoice.receiveAmount,
		sourceChain: input.invoice.sourceChain ?? 'Unknown',
		sourceChainId: input.invoice.sourceChainId ?? 0,
		sourceToken: input.invoice.sourceToken ?? 'USDC',
		sourceTxHash: input.invoice.sourceTxHash,
		destinationTxHash: asHexHash(input.destinationTxHash),
		lifiStatus: input.lifiStatus,
		lifiSubstatus: input.lifiSubstatus ?? undefined,
		feePolicy: input.invoice.feePolicy,
		createdAt: input.now ?? Date.now(),
	};

	return {
		...receipt,
		receiptHash: keccak256(stringToHex(JSON.stringify(receipt))),
	};
}

export function resolveInvoiceStatusFromLifiStatus(input: {
	invoice: Invoice;
	lifiStatus: LifiStatusResponse;
	now?: number;
}): Invoice {
	const resolved = resolveLifiRouteStatus(input.lifiStatus);

	if (resolved.clientStatus === 'confirmed') {
		const receipt = generateReceipt({
			invoice: input.invoice,
			destinationTxHash: resolved.receivingTxHash ?? undefined,
			lifiStatus: input.lifiStatus.status,
			lifiSubstatus: input.lifiStatus.substatus,
			now: input.now,
		});

		return {
			...input.invoice,
			status: 'RECEIPT_GENERATED',
			destinationTxHash: receipt.destinationTxHash,
			lifiStatus: input.lifiStatus.status,
			lifiSubstatus: input.lifiStatus.substatus,
			receipt,
		};
	}

	if (resolved.clientStatus === 'failed') {
		return {
			...input.invoice,
			status: 'FAILED',
			lifiStatus: input.lifiStatus.status,
			lifiSubstatus: input.lifiStatus.substatus,
		};
	}

	return {
		...input.invoice,
		status: 'PAYMENT_PENDING',
		lifiStatus: input.lifiStatus.status,
		lifiSubstatus: input.lifiStatus.substatus,
	};
}

export function buildSupportPackage(input: {
	invoice: Invoice;
	issueSummary?: string;
}): SupportPackage {
	const invoice = input.invoice;
	const status = [invoice.lifiStatus, invoice.lifiSubstatus]
		.filter(Boolean)
		.join(' / ') || invoice.status;

	return {
		invoiceId: invoice.invoiceId,
		payerAddress: invoice.payerAddress,
		merchantAddress: invoice.merchantAddress,
		sourceChain: invoice.sourceChain,
		targetChain: invoice.receiveChain,
		sourceTxHash: invoice.sourceTxHash,
		destinationTxHash: invoice.destinationTxHash,
		lifiStatus: invoice.lifiStatus,
		lifiSubstatus: invoice.lifiSubstatus,
		issueSummary:
			input.issueSummary ??
			`Payment support package for invoice ${invoice.invoiceId}.`,
		userFriendlyExplanation: `Current LI.FI status is ${status}. ChainCashier does not custody funds; use the source transaction hash and LI.FI route status to trace the payment.`,
		merchantViewExplanation: `Merchant terms remain locked: receive ${invoice.receiveAmount} ${invoice.receiveToken} on ${invoice.receiveChain} at ${invoice.merchantAddress}.`,
		recommendedNextSteps: [
			'Open the source transaction in the source-chain explorer.',
			'Check LI.FI status using the saved sourceTxHash.',
			'If the route failed or refunded, ask the payer to retry from a fresh quote.',
		],
		evidence: {
			invoice,
			receipt: invoice.receipt,
		},
	};
}
