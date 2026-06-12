import {
	buildPaymentQuoteRequest,
	createInvoiceFromAgentOutput,
	type PaymentQuoteSummary,
	type Invoice,
} from './chainCashier';
import {
	CHAINCASHIER_PAYMENT_ROUTES,
	CHAINCASHIER_USDC_CHAINS,
	type ChainCashierChainKey,
} from './chainCashierChains';

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
	CHAINCASHIER_USDC_CHAINS.Arbitrum,
	CHAINCASHIER_USDC_CHAINS.Base,
	CHAINCASHIER_USDC_CHAINS.Optimism,
	CHAINCASHIER_USDC_CHAINS.Polygon,
].map((chain) => ({
	label: `${chain.label} USDC`,
	chainId: chain.chainId,
	tokenAddress: chain.usdcAddress,
}));

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

function parseReceiveChain(message: string): 'Base' | 'Arbitrum' {
	const lowered = message.toLowerCase();
	if (lowered.includes('arbitrum') || lowered.includes('arb')) {
		return 'Arbitrum';
	}

	return 'Base';
}

function sourceOptionFromChainKey(
	chainKey: ChainCashierChainKey,
): PayerSourceOption {
	const chain = CHAINCASHIER_USDC_CHAINS[chainKey];
	return {
		label: `${chain.label} USDC`,
		chainId: chain.chainId,
		tokenAddress: chain.usdcAddress,
	};
}

function getSupportedSourceOptions(invoice: Invoice): PayerSourceOption[] {
	const target = invoice.receiveChain as keyof typeof CHAINCASHIER_PAYMENT_ROUTES;
	const routeSourceKeys = CHAINCASHIER_PAYMENT_ROUTES[target] ?? [];
	return routeSourceKeys.map(sourceOptionFromChainKey);
}

function formatSourceOptions(options: PayerSourceOption[]): string {
	return options.map((option) => option.label).join(', ');
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
		normalized.includes('帐单') ||
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
				'我是 ChainCashier，一个面向 Web3 商户的跨链收款 Agent。我可以帮你创建 Base 或 Arbitrum USDC 收款账单、生成付款链接，并让付款人在独立页面选择来源链后用自己的钱包确认支付。你可以告诉我收款金额，例如：创建一个 20 USDC 的收款单。',
		},
		{ type: 'done' },
	];
}

export function buildMerchantMissingAmountResponse(): ChainCashierChatChunk[] {
	return [
		{
			type: 'response',
			content:
				'可以。我需要先知道收款金额。当前支持商户收 Base 或 Arbitrum USDC，例如：创建一个 20 USDC 的收款单，或者创建一个收 Arbitrum 的 20 USDC 收款单。',
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

	const receiveChain = parseReceiveChain(input.message);
	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: input.merchantAddress,
		origin: input.origin,
		now: input.now,
		agentOutput: {
			invoice: {
				receiveChain,
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
			content: `Locking merchant address, ${invoice.receiveChain} USDC target, amount, and payer-pays fee policy...\n`,
		},
		{ type: 'invoice', invoice },
		{
			type: 'response',
			content: [
				'好的，我已经生成收款账单。',
				'',
				`- Merchant receives: ${invoice.receiveAmount} ${invoice.receiveToken} on ${invoice.receiveChain}`,
				`- Merchant address: ${invoice.merchantAddress}`,
				'- Fee policy: payer covers cross-chain cost',
				`- Payment link: ${invoice.paymentLink}`,
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
	for (const chain of Object.values(CHAINCASHIER_USDC_CHAINS)) {
		if (
			chain.aliases.some((alias) => lowered.includes(alias)) ||
			lowered.includes(chain.label.toLowerCase())
		) {
			return {
				label: `${chain.label} USDC`,
				chainId: chain.chainId,
				tokenAddress: chain.usdcAddress,
			};
		}
	}

	return null;
}

export function buildPayerQuotePlan(input: {
	message: string;
	invoice: Invoice;
	payerAddress: string;
}): ChainCashierChatChunk[] {
	const supportedSources = getSupportedSourceOptions(input.invoice);
	const source = resolvePayerSourceFromMessage(input.message);
	if (
		!source ||
		!supportedSources.some((option) => option.chainId === source.chainId)
	) {
		return [
			{
				type: 'response',
				content: `我还需要知道你想从哪条支持的来源链支付。当前这张账单收 ${input.invoice.receiveChain} USDC，支持：${formatSourceOptions(supportedSources)}。`,
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
