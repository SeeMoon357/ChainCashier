import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('ChainCashier chain config builds explorer transaction links', async () => {
	const { getChainCashierExplorerTxUrl } = await loadTsModule(
		'./lib/chainCashierChains.ts',
	);

	assert.equal(
		getChainCashierExplorerTxUrl(
			8453,
			'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		),
		'https://basescan.org/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	);
	assert.equal(
		getChainCashierExplorerTxUrl(
			42161,
			'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
		),
		'https://arbiscan.io/tx/0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	);
	assert.equal(
		getChainCashierExplorerTxUrl(
			10,
			'0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
		),
		'https://optimistic.etherscan.io/tx/0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
	);
	assert.equal(
		getChainCashierExplorerTxUrl(
			137,
			'0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
		),
		'https://polygonscan.com/tx/0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
	);
	assert.equal(getChainCashierExplorerTxUrl(1, '0xabc'), null);
	assert.equal(getChainCashierExplorerTxUrl(8453, undefined), null);
});
