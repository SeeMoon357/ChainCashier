import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('buildMerchantChatCreatedInvoice returns streamed chunks with invoice and payment link', async () => {
	const { buildMerchantChatCreatedInvoice } = await loadTsModule(
		'./lib/chainCashierChat.ts',
	);

	const chunks = buildMerchantChatCreatedInvoice({
		message: 'Create an invoice to receive 20 USDC on Base for a workshop ticket.',
		merchantAddress: '0x1111111111111111111111111111111111111111',
		origin: 'http://localhost:3000',
		now: 1_750_000_000_000,
	});

	assert.equal(chunks[0].type, 'thinking');
	assert.equal(chunks[1].type, 'run_event');
	assert.equal(chunks[1].event.tool, 'GLM-5.1 structured generation');
	assert.equal(chunks[2].type, 'thinking');
	assert.equal(chunks[3].type, 'run_event');
	assert.equal(chunks[3].event.step, 'invoice');
	assert.equal(chunks[4].type, 'invoice');
	assert.equal(chunks[4].invoice.invoiceId, 'INV-1750000000000');
	assert.equal(chunks[4].invoice.paymentLink, 'http://localhost:3000/pay/INV-1750000000000');
	assert.equal(chunks[5].type, 'run_event');
	assert.equal(chunks[5].event.artifact, 'payment link');
	assert.equal(chunks[6].type, 'response');
	assert.match(chunks[6].content, /20 USDC on Base/);
	assert.match(chunks[6].content, /Payment link/);
});

test('buildMerchantChatCreatedInvoice creates Arbitrum invoices when requested', async () => {
	const { buildMerchantChatCreatedInvoice } = await loadTsModule(
		'./lib/chainCashierChat.ts',
	);

	const chunks = buildMerchantChatCreatedInvoice({
		message: 'Create an invoice to receive 20 USDC on Arbitrum for a workshop ticket.',
		merchantAddress: '0x1111111111111111111111111111111111111111',
		origin: 'http://localhost:3000',
		now: 1,
	});

	const invoiceChunk = chunks.find((chunk) => chunk.type === 'invoice');
	const responseChunk = chunks.find((chunk) => chunk.type === 'response');
	assert.equal(invoiceChunk?.type, 'invoice');
	assert.equal(invoiceChunk.invoice.receiveChain, 'Arbitrum');
	assert.equal(invoiceChunk.invoice.receiveChainId, 42161);
	assert.equal(responseChunk?.type, 'response');
	assert.match(responseChunk.content, /20 USDC on Arbitrum/);
});

test('resolveMerchantRequest routes identity questions away from invoice creation', async () => {
	const { resolveMerchantRequest } = await loadTsModule(
		'./lib/chainCashierChat.ts',
	);

	assert.deepEqual(resolveMerchantRequest('你是谁？'), { kind: 'general' });
	assert.deepEqual(resolveMerchantRequest('who are you?'), { kind: 'general' });
});

test('resolveMerchantRequest requires an amount before invoice creation', async () => {
	const { resolveMerchantRequest } = await loadTsModule(
		'./lib/chainCashierChat.ts',
	);

	assert.deepEqual(resolveMerchantRequest('帮我生成一个收款单'), {
		kind: 'invoice_missing_amount',
	});
	assert.deepEqual(resolveMerchantRequest('Create an invoice to receive 20 USDC on Base.'), {
		kind: 'create_invoice',
		amount: '20',
	});
});

test('resolvePayerSourceFromMessage recognizes supported source chains', async () => {
	const { resolvePayerSourceFromMessage } = await loadTsModule(
		'./lib/chainCashierChat.ts',
	);

	assert.deepEqual(
		resolvePayerSourceFromMessage('I want to pay with USDC on Arbitrum.'),
		{
			label: 'Arbitrum USDC',
			chainId: 42161,
			tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
		},
	);
	assert.deepEqual(
		resolvePayerSourceFromMessage('Use base usdc please.'),
		{
			label: 'Base USDC',
			chainId: 8453,
			tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		},
	);
	assert.deepEqual(
		resolvePayerSourceFromMessage('Use optimism usdc please.'),
		{
			label: 'Optimism USDC',
			chainId: 10,
			tokenAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
		},
	);
	assert.equal(resolvePayerSourceFromMessage('I am not sure yet.'), null);
});

test('buildPayerQuotePlan emits source selection and quote request chunks', async () => {
	const { buildPayerQuotePlan, createInvoiceFromAgentOutput } =
		await loadTsModule('./lib/chainCashierChat.ts');
	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: '0x2222222222222222222222222222222222222222',
		origin: 'http://localhost:3000',
		agentOutput: {
			invoice: {
				receiveChain: 'Base',
				receiveToken: 'USDC',
				receiveAmount: '20',
			},
		},
		now: 1,
	});

	const chunks = buildPayerQuotePlan({
		message: 'Pay with Arbitrum USDC.',
		invoice,
		payerAddress: '0x3333333333333333333333333333333333333333',
	});

	assert.equal(chunks[0].type, 'thinking');
	assert.equal(chunks[1].type, 'run_event');
	assert.equal(chunks[1].event.step, 'source');
	assert.equal(chunks[2].type, 'payer_source');
	assert.equal(chunks[2].source.chainId, 42161);
	assert.equal(chunks[3].type, 'run_event');
	assert.equal(chunks[3].event.tool, 'LI.FI quote/toAmount');
	assert.equal(chunks[4].type, 'quote_request');
	assert.equal(chunks[4].request.toChain, 8453);
	assert.equal(chunks[4].request.toAddress, invoice.merchantAddress);
});

test('buildPayerQuotePlan supports Base source for Arbitrum invoices', async () => {
	const { buildPayerQuotePlan, createInvoiceFromAgentOutput } =
		await loadTsModule('./lib/chainCashierChat.ts');
	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: '0x2222222222222222222222222222222222222222',
		origin: 'http://localhost:3000',
		agentOutput: {
			invoice: {
				receiveChain: 'Arbitrum',
				receiveToken: 'USDC',
				receiveAmount: '20',
			},
		},
		now: 1,
	});

	const chunks = buildPayerQuotePlan({
		message: 'Pay with Base USDC.',
		invoice,
		payerAddress: '0x3333333333333333333333333333333333333333',
	});

	const sourceChunk = chunks.find((chunk) => chunk.type === 'payer_source');
	const quoteRequestChunk = chunks.find((chunk) => chunk.type === 'quote_request');
	assert.equal(sourceChunk?.type, 'payer_source');
	assert.equal(sourceChunk.source.chainId, 8453);
	assert.equal(quoteRequestChunk?.type, 'quote_request');
	assert.equal(quoteRequestChunk.request.fromChain, 8453);
	assert.equal(quoteRequestChunk.request.toChain, 42161);
});

test('buildPayerQuotePlan filters unsupported sources for the invoice target', async () => {
	const { buildPayerQuotePlan, createInvoiceFromAgentOutput } =
		await loadTsModule('./lib/chainCashierChat.ts');
	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: '0x2222222222222222222222222222222222222222',
		origin: 'http://localhost:3000',
		agentOutput: {
			invoice: {
				receiveChain: 'Arbitrum',
				receiveToken: 'USDC',
				receiveAmount: '20',
			},
		},
		now: 1,
	});

	const chunks = buildPayerQuotePlan({
		message: 'Pay with Optimism USDC.',
		invoice,
		payerAddress: '0x3333333333333333333333333333333333333333',
	});

	assert.equal(chunks[0].type, 'response');
	assert.match(chunks[0].content, /Base USDC/);
	assert.doesNotMatch(chunks[0].content, /Optimism USDC/);
	assert.equal(chunks[1].type, 'run_event');
	assert.equal(chunks[1].event.step, 'repair');
	assert.equal(chunks[1].event.status, 'action_required');
});
