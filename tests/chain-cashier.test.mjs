import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from './helpers/load-ts-module.mjs';

const modulePath = './lib/chainCashier.ts';

test('createInvoiceFromAgentOutput locks merchant receiving terms and payment link', async () => {
	const { createInvoiceFromAgentOutput } = await loadTsModule(modulePath);

	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: '0x1111111111111111111111111111111111111111',
		origin: 'http://localhost:3000',
		agentOutput: {
			invoice: {
				receiveChain: 'Base',
				receiveToken: 'USDC',
				receiveAmount: '20',
				memo: 'Web3 workshop ticket',
			},
		},
		now: 1_750_000_000_000,
	});

	assert.equal(invoice.invoiceId, 'INV-1750000000000');
	assert.equal(invoice.merchantAddress, '0x1111111111111111111111111111111111111111');
	assert.equal(invoice.receiveChainId, 8453);
	assert.equal(invoice.receiveTokenAddress, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
	assert.equal(invoice.receiveAmount, '20');
	assert.equal(invoice.feePolicy, 'PAYER_PAYS');
	assert.equal(invoice.status, 'CREATED');
	assert.equal(invoice.paymentLink, 'http://localhost:3000/pay/INV-1750000000000');
});

test('buildPaymentQuoteRequest uses invoice target and payer source for toAmount quotes', async () => {
	const { createInvoiceFromAgentOutput, buildPaymentQuoteRequest } =
		await loadTsModule(modulePath);
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

	const request = buildPaymentQuoteRequest({
		invoice,
		payerAddress: '0x3333333333333333333333333333333333333333',
		sourceChainId: 42161,
		sourceTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
	});

	assert.deepEqual(request, {
		fromChain: 42161,
		toChain: 8453,
		fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
		toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		fromAddress: '0x3333333333333333333333333333333333333333',
		toAddress: '0x2222222222222222222222222222222222222222',
		toAmount: '20000000',
	});
});

test('summarizePaymentQuote blocks quotes that do not pay the locked merchant target', async () => {
	const { createInvoiceFromAgentOutput, summarizePaymentQuote } =
		await loadTsModule(modulePath);
	const invoice = createInvoiceFromAgentOutput({
		merchantAddress: '0x4444444444444444444444444444444444444444',
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

	assert.throws(
		() =>
			summarizePaymentQuote({
				invoice,
				sourceChainId: 42161,
				sourceTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
				rawQuote: {
					action: {
						fromAmount: '20100000',
						toAmount: '20000000',
						fromChainId: 42161,
						toChainId: 8453,
						fromToken: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
						toToken: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
						toAddress: '0x5555555555555555555555555555555555555555',
					},
				},
			}),
		/Quote target address does not match the locked merchant address/,
	);
});

test('resolveInvoiceStatusFromLifiStatus generates a receipt when the route is completed', async () => {
	const { createInvoiceFromAgentOutput, resolveInvoiceStatusFromLifiStatus } =
		await loadTsModule(modulePath);
	const invoice = {
		...createInvoiceFromAgentOutput({
			merchantAddress: '0x6666666666666666666666666666666666666666',
			origin: 'http://localhost:3000',
			agentOutput: {
				invoice: {
					receiveChain: 'Base',
					receiveToken: 'USDC',
					receiveAmount: '20',
				},
			},
			now: 1,
		}),
		payerAddress: '0x7777777777777777777777777777777777777777',
		sourceChain: 'Arbitrum',
		sourceChainId: 42161,
		sourceToken: 'USDC',
		sourceTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
		sourceTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	};

	const updated = resolveInvoiceStatusFromLifiStatus({
		invoice,
		lifiStatus: {
			status: 'DONE',
			substatus: 'COMPLETED',
			receiving: {
				txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
				chainId: 8453,
				token: { symbol: 'USDC' },
			},
		},
		now: 2,
	});

	assert.equal(updated.status, 'RECEIPT_GENERATED');
	assert.equal(updated.receipt?.invoiceId, invoice.invoiceId);
	assert.equal(updated.receipt?.receiveAmount, '20');
	assert.equal(updated.receipt?.sourceTxHash, invoice.sourceTxHash);
	assert.equal(updated.receipt?.destinationTxHash, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
	assert.match(updated.receipt?.receiptHash ?? '', /^0x[0-9a-f]{64}$/);
});

test('buildSupportPackage explains failed payments with evidence and next steps', async () => {
	const { createInvoiceFromAgentOutput, buildSupportPackage } =
		await loadTsModule(modulePath);
	const invoice = {
		...createInvoiceFromAgentOutput({
			merchantAddress: '0x8888888888888888888888888888888888888888',
			origin: 'http://localhost:3000',
			agentOutput: {
				invoice: {
					receiveChain: 'Base',
					receiveToken: 'USDC',
					receiveAmount: '20',
				},
			},
			now: 1,
		}),
		payerAddress: '0x9999999999999999999999999999999999999999',
		sourceChain: 'Arbitrum',
		sourceTxHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
		lifiStatus: 'FAILED',
		lifiSubstatus: 'REFUNDED',
	};

	const supportPackage = buildSupportPackage({
		invoice,
		issueSummary: 'Payer says they paid, but merchant dashboard is not paid.',
	});

	assert.equal(supportPackage.invoiceId, invoice.invoiceId);
	assert.equal(supportPackage.targetChain, 'Base');
	assert.match(supportPackage.userFriendlyExplanation, /FAILED/);
	assert.ok(supportPackage.recommendedNextSteps.length >= 3);
	assert.deepEqual(supportPackage.evidence.invoice, invoice);
});
