import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadLifiStatusModule() {
	return loadTsModule('./lib/lifiStatus.ts');
}

test('resolveLifiRouteStatus treats refunded routes as failed refunds to the actual receiving chain', async () => {
	const { resolveLifiRouteStatus } = await loadLifiStatusModule();

	const result = resolveLifiRouteStatus({
		status: 'DONE',
		substatus: 'REFUNDED',
		substatusMessage: 'The tokens were refunded to the user.',
		receiving: {
			txHash: '0xrefund',
			chainId: 8453,
			token: {
				symbol: 'cbBTC',
			},
		},
	});

	assert.equal(result.routeStatus, 'refunded');
	assert.equal(result.clientStatus, 'failed');
	assert.equal(result.receivingChainId, 8453);
	assert.equal(result.receivingTokenSymbol, 'cbBTC');
	assert.match(result.message, /refunded/i);
	assert.match(result.message, /Base/i);
	assert.match(result.message, /cbBTC/i);
});

test('resolveLifiRouteStatus treats completed routes as confirmed on the destination chain', async () => {
	const { resolveLifiRouteStatus } = await loadLifiStatusModule();

	const result = resolveLifiRouteStatus({
		status: 'DONE',
		substatus: 'COMPLETED',
		receiving: {
			txHash: '0xdone',
			chainId: 137,
			token: {
				symbol: 'amUSDC',
			},
		},
	});

	assert.equal(result.routeStatus, 'completed');
	assert.equal(result.clientStatus, 'confirmed');
	assert.equal(result.receivingChainId, 137);
	assert.equal(result.receivingTokenSymbol, 'amUSDC');
	assert.match(result.message, /completed/i);
	assert.match(result.message, /Polygon/i);
});

test('resolveLifiRouteStatus keeps pending routes in tracking state', async () => {
	const { resolveLifiRouteStatus } = await loadLifiStatusModule();

	const result = resolveLifiRouteStatus({
		status: 'PENDING',
	});

	assert.equal(result.routeStatus, 'pending');
	assert.equal(result.clientStatus, 'tracking_route');
	assert.match(result.message, /tracking/i);
});
