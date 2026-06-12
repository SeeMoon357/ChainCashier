import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('business chain config exposes the current official Earn chain set', async () => {
	const {
		SUPPORTED_EARN_CHAIN_IDS,
		SUPPORTED_EARN_TARGET_CHAIN_IDS,
		CHAIN_CONFIG_BY_ID,
		formatSupportedBusinessChainNames,
	} = await loadTsModule('./lib/businessChains.ts');

	assert.deepEqual(SUPPORTED_EARN_CHAIN_IDS, [1, 8453, 42161]);
	assert.deepEqual(SUPPORTED_EARN_TARGET_CHAIN_IDS, [1, 8453, 42161, 137]);
	assert.equal(CHAIN_CONFIG_BY_ID[1].name, 'Ethereum');
	assert.equal(CHAIN_CONFIG_BY_ID[8453].name, 'Base');
	assert.equal(CHAIN_CONFIG_BY_ID[42161].name, 'Arbitrum');
	assert.equal(CHAIN_CONFIG_BY_ID[137].name, 'Polygon');
	assert.equal(CHAIN_CONFIG_BY_ID[137].nativeSymbol, 'POL');
	assert.equal(CHAIN_CONFIG_BY_ID[137].earnEnabled, false);
	assert.equal(CHAIN_CONFIG_BY_ID[137].earnTargetEnabled, true);
	assert.equal(formatSupportedBusinessChainNames(), 'Ethereum、Base、Arbitrum、Polygon');
});

test('business chain config returns stable chain labels, explorers, and USDC addresses', async () => {
	const { getChainLabel, getExplorerTxBaseUrl, getUsdcAddress } =
		await loadTsModule('./lib/businessChains.ts');

	assert.equal(getChainLabel(1), 'Ethereum');
	assert.equal(getChainLabel(8453), 'Base');
	assert.equal(getChainLabel(42161), 'Arbitrum');
	assert.equal(getChainLabel(137), 'Polygon');
	assert.equal(getChainLabel(10), 'Chain 10');

	assert.equal(getExplorerTxBaseUrl(1), 'https://etherscan.io/tx/');
	assert.equal(getExplorerTxBaseUrl(8453), 'https://basescan.org/tx/');
	assert.equal(getExplorerTxBaseUrl(42161), 'https://arbiscan.io/tx/');
	assert.equal(getExplorerTxBaseUrl(137), 'https://polygonscan.com/tx/');

	assert.equal(
		getUsdcAddress(1),
		'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
	);
	assert.equal(
		getUsdcAddress(8453),
		'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
	);
	assert.equal(
		getUsdcAddress(42161),
		'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
	);
	assert.equal(
		getUsdcAddress(137),
		'0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
	);
	assert.equal(getUsdcAddress(10), null);
});

test('business chain config exposes current supported cross-chain Earn pairs', async () => {
	const {
		SUPPORTED_CROSS_CHAIN_EARN_PAIRS,
		isSupportedCrossChainEarnPair,
	} = await loadTsModule('./lib/businessChains.ts');

	assert.deepEqual(SUPPORTED_CROSS_CHAIN_EARN_PAIRS, [
		{ fromChainId: 1, toChainId: 8453 },
		{ fromChainId: 1, toChainId: 42161 },
		{ fromChainId: 8453, toChainId: 42161 },
		{ fromChainId: 42161, toChainId: 8453 },
		{ fromChainId: 8453, toChainId: 137 },
	]);

	assert.equal(isSupportedCrossChainEarnPair(1, 8453), true);
	assert.equal(isSupportedCrossChainEarnPair(8453, 42161), true);
	assert.equal(isSupportedCrossChainEarnPair(8453, 137), true);
	assert.equal(isSupportedCrossChainEarnPair(1, 137), false);
	assert.equal(isSupportedCrossChainEarnPair(8453, 1), false);
	assert.equal(isSupportedCrossChainEarnPair(10, 8453), false);
});
