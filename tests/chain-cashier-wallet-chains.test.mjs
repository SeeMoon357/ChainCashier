import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('resolves supported payer source chains for wallet execution', async () => {
	const { getChainCashierWalletChain } = await loadTsModule(
		'./lib/chainCashierWalletChains.ts',
	);

	assert.equal(getChainCashierWalletChain(8453)?.name, 'Base');
	assert.equal(getChainCashierWalletChain(42161)?.name, 'Arbitrum One');
	assert.equal(getChainCashierWalletChain(10)?.name, 'OP Mainnet');
	assert.equal(getChainCashierWalletChain(137)?.name, 'Polygon');
});

test('rejects unsupported wallet execution chains', async () => {
	const { getChainCashierWalletChain } = await loadTsModule(
		'./lib/chainCashierWalletChains.ts',
	);

	assert.equal(getChainCashierWalletChain(1), undefined);
});
