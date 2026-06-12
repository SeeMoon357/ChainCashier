import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadWalletContextModule() {
	return loadTsModule('./lib/walletContext.ts');
}

test('wallet context helpers detect address questions and format a deterministic response', async () => {
	const { isWalletContextQuestion, buildWalletContextResponse } =
		await loadWalletContextModule();

	assert.equal(isWalletContextQuestion('what is my wallet address?'), true);
	assert.equal(isWalletContextQuestion('find best vault on base'), false);

	const response = buildWalletContextResponse({
		userAddress: '0x1111111111111111111111111111111111111111',
		walletChainId: 8453,
	});

	assert.match(response, /Connected wallet: 0x1111111111111111111111111111111111111111/);
	assert.match(response, /Current chain: Base \(8453\)/);
});
