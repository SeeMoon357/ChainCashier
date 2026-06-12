import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadIntentStatusModule() {
	return loadTsModule('./lib/lifiIntentStatus.ts');
}

test('extractIntentOrderIdFromLogs reads order id from InputSettlerEscrow Open event', async () => {
	const { extractIntentOrderIdFromLogs } = await loadIntentStatusModule();

	const orderId = extractIntentOrderIdFromLogs([
		{
			address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
			topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
		},
		{
			address: '0x000025c3226c00b2cdc200005a1600509f4e00c0',
			topics: [
				'0x9ff74bd56d00785b881ef9fa3f03d7b598686a39a9bcff89a6008db588b18a7b',
				'0x274803327c4f4ff16515ad3c3dbbbe983768463c41b8a4ee2844f283690f0448',
			],
		},
	]);

	assert.equal(
		orderId,
		'0x274803327c4f4ff16515ad3c3dbbbe983768463c41b8a4ee2844f283690f0448',
	);
});

test('normalizeLifiIntentOrderStatus maps Signed orders without delivery tx', async () => {
	const { normalizeLifiIntentOrderStatus } = await loadIntentStatusModule();

	const normalized = normalizeLifiIntentOrderStatus({
		meta: {
			orderStatus: 'Signed',
			orderIdentifier: 'intent_abc',
			onChainOrderId: '0xorder',
			orderDeliveredTxHash: null,
			orderSettledTxHash: null,
			deliveredAt: null,
			settledAt: null,
		},
	});

	assert.deepEqual(normalized, {
		orderId: '0xorder',
		orderIdentifier: 'intent_abc',
		orderStatus: 'Signed',
		deliveredAt: null,
		settledAt: null,
		deliveredTxHash: null,
		settledTxHash: null,
		deliveryExplorerLink: null,
	});
});

test('normalizeLifiIntentOrderStatus exposes delivered tx and Arbiscan link', async () => {
	const { normalizeLifiIntentOrderStatus } = await loadIntentStatusModule();

	const normalized = normalizeLifiIntentOrderStatus({
		meta: {
			orderStatus: 'Delivered',
			orderIdentifier: 'intent_done',
			onChainOrderId: '0xorder',
			orderDeliveredTxHash:
				'0x7744f6b7adb1744fab1213125467973231f770272d26e70b01fa42dae7b4bfff',
			orderSettledTxHash: null,
			deliveredAt: '2026-05-28T08:30:00.000Z',
			settledAt: null,
		},
	});

	assert.equal(normalized.orderStatus, 'Delivered');
	assert.equal(
		normalized.deliveredTxHash,
		'0x7744f6b7adb1744fab1213125467973231f770272d26e70b01fa42dae7b4bfff',
	);
	assert.equal(
		normalized.deliveryExplorerLink,
		'https://arbiscan.io/tx/0x7744f6b7adb1744fab1213125467973231f770272d26e70b01fa42dae7b4bfff',
	);
});
