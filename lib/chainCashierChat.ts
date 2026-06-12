import {
	buildPaymentQuoteRequest,
	createInvoiceFromAgentOutput,
	type PaymentQuoteSummary,
	type Invoice,
} from './chainCashier';

export { createInvoiceFromAgentOutput } from './chainCashier';

export type PayerSourceOption = {
	label: string;
	chainId: number;
	tokenAddress: `0x${string}`;
};

export type MerchantRequest =
	| { kind: 'general' }
	| { kind: 'invoice_missing_amount' }
	| { kind: 'create_invoice'; amount: string };

export const PAYER_SOURCE_OPTIONS: PayerSourceOption[] = [
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

export type ChainCashierChatChunk =
	| { type: 'thinking'; content: string }
	| { type: 'response'; content: string }
	| { type: 'invoice'; invoice: Invoice }
	| { type: 'payer_source'; source: PayerSourceOption }
	| {
			type: 'quote_request';
			source: PayerSourceOption;
			request: ReturnType<typeof buildPaymentQuoteRequest>;
	  }
	| { type: 'quote'; quote: PaymentQuoteSummary; rawQuote?: unknown }
	| { type: 'error'; content: string }
	| { type: 'done' };

function parseAmount(message: string): string | null {
	return message.match(/(\d+(?:\.\d+)?)\s*(?:USDC|U|美元|刀)?/i)?.[1] ?? null;
}

function parseMemo(message: string): string {
	const normalized = message.replace(/\s+/g, ' ').trim();
	return normalized || 'ChainCashier invoice';
}

export function resolveMerchantRequest(message: string): MerchantRequest {
	const normalized = message.trim().toLowerCase();
	const asksIdentity =
		normalized.includes('你是谁') ||
		normalized.includes('who are you') ||
		normalized.includes('what are you') ||
		normalized.includes('介绍一下') ||
		normalized.includes('你能做什么');
	if (asksIdentity) {
		return { kind: 'general' };
	}

	const invoiceIntent =
		normalized.includes('invoice') ||
		normalized.includes('收款') ||
		normalized.includes('账单') ||
		normalized.includes('帳單') ||
		normalized.includes('付款链接') ||
		normalized.includes('payment link') ||
		normalized.includes('checkout');
	if (!invoiceIntent) {
		return { kind: 'general' };
	}

	const amount = parseAmount(message);
	if (!amount) {
		return { kind: 'invoice_missing_amount' };
	}

	return { kind: 'create_invoice', amount };
}

export function buildMerchantGeneralResponse(): ChainCashierChatChunk[] {
	return [
		{
			type: 'response',
			content:
				'我是 ChainCashier，一个面向 Web3 商户的跨链收款 Agent。我可以帮你创建 Base USDC 收款账单、生成付款链接，并让付款人在独立页面选择来源链后通过自己的钱包支付。你可以告诉我收款金额，例如：创建一个 20 USDC 的收款单。',
		},
		{ type: 'done' },
	];
}

export function buildMerchantMissingAmountResponse(): ChainCashierChatChunk[] {
	return [
		{
			type: 'response',
			content:
				'可以。我需要先知道收款金额。当前 MVP 支持商户在 Base 收 USDC，例如你可以说：创建一个 20 USDC 的收款单。',
		},
		{ type: 'done' },
	];
}

export function buildMerchantChatCreatedInvoice(input: {
	message: string;
	merchantAddress: string;
	origin: string;
	now?: number;
}): ChainCashierChatChunk[] {
	const amount = parseAmount(input.message);
	if (!amount) {
		return buildMerchantMissingAmountResponse();
	}

	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: input.merchantAddress,
		origin: input.origin,
		now: input.now,
		agentOutput: {
			invoice: {
				receiveChain: 'Base',
				receiveToken: 'USDC',
				receiveAmount: amount,
				memo: parseMemo(input.message),
			},
		},
	});

	return [
		{
			type: 'thinking',
			content: 'Parsing merchant invoice goal...\n',
		},
		{
			type: 'thinking',
			content: 'Locking merchant address, Base USDC target, amount, and payer-pays fee policy...\n',
		},
		{ type: 'invoice', invoice },
		{
			type: 'response',
			content: [
				'好的，我已经生成收款账单。',
				'',
				`- 商户收款：${invoice.receiveAmount} ${invoice.receiveToken} on ${invoice.receiveChain}`,
				`- 收款地址：${invoice.merchantAddress}`,
				'- 费用规则：付款人承担跨链成本',
				`- 付款链接：${invoice.paymentLink}`,
				'',
				'你可以把这个链接发给付款人。付款人会在独立 checkout 聊天页里选择来源链，并通过自己的钱包确认支付。',
			].join('\n'),
		},
		{ type: 'done' },
	];
}

export function resolvePayerSourceFromMessage(
	message: string,
): PayerSourceOption | null {
	const lowered = message.toLowerCase();
	if (lowered.includes('arbitrum') || lowered.includes('arb')) {
		return PAYER_SOURCE_OPTIONS[0];
	}
	if (lowered.includes('optimism') || lowered.includes('op mainnet')) {
		return PAYER_SOURCE_OPTIONS[1];
	}
	if (lowered.includes('polygon') || lowered.includes('matic')) {
		return PAYER_SOURCE_OPTIONS[2];
	}

	return null;
}

export function buildPayerQuotePlan(input: {
	message: string;
	invoice: Invoice;
	payerAddress: string;
}): ChainCashierChatChunk[] {
	const source = resolvePayerSourceFromMessage(input.message);
	if (!source) {
		return [
			{
				type: 'response',
				content:
					'我还需要知道你想从哪条链支付。当前支持 Arbitrum USDC、Optimism USDC 或 Polygon USDC。',
			},
			{ type: 'done' },
		];
	}

	const request = buildPaymentQuoteRequest({
		invoice: input.invoice,
		payerAddress: input.payerAddress,
		sourceChainId: source.chainId,
		sourceTokenAddress: source.tokenAddress,
	});

	return [
		{
			type: 'thinking',
			content: 'Reading locked merchant invoice and payer source request...\n',
		},
		{ type: 'payer_source', source },
		{ type: 'quote_request', source, request },
	];
}
