import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadExecutionHelpersModule() {
	return loadTsModule('./lib/executionHelpers.ts');
}

test('runExecutionPreflight returns ready when wallet, gas, allowance, and approval target are valid', async () => {
	const { runExecutionPreflight } = await loadExecutionHelpersModule();

	const result = runExecutionPreflight({
		preview: {
			fromChain: 8453,
			toChain: 8453,
			quote: {
				action: {
					fromAmount: '5000000',
					fromToken: { address: '0xusdc', symbol: 'USDC' },
				},
				estimate: {
					approvalAddress: '0xapproval',
					gasCosts: [{ amount: '1000', amountUSD: '0.02', token: { symbol: 'ETH' } }],
				},
				transactionRequest: { to: '0xrouter', data: '0x1234' },
			},
		},
		wallet: {
			address: '0xuser',
			chainId: 8453,
			nativeBalance: 5000n,
			allowance: 5000000n,
		},
	});

	assert.equal(result.ready, true);
	assert.equal(result.requiresApproval, false);
	assert.equal(result.reason, null);
	assert.equal(result.allowanceSufficient, true);
	assert.equal(result.nativeGasSufficient, true);
});

test('runExecutionPreflight blocks when approval target is missing', async () => {
	const { runExecutionPreflight } = await loadExecutionHelpersModule();

	const result = runExecutionPreflight({
		preview: {
			fromChain: 8453,
			toChain: 8453,
			quote: {
				action: {
					fromAmount: '5000000',
					fromToken: { address: '0xusdc', symbol: 'USDC' },
				},
				estimate: {
					gasCosts: [{ amount: '1000', amountUSD: '0.02', token: { symbol: 'ETH' } }],
				},
				transactionRequest: { to: '0xrouter', data: '0x1234' },
			},
		},
		wallet: {
			address: '0xuser',
			chainId: 8453,
			nativeBalance: 5000n,
			allowance: 0n,
		},
	});

	assert.equal(result.ready, false);
	assert.equal(result.reason, 'blocked_missing_approval_target');
});

test('runExecutionPreflight blocks when native gas balance is insufficient', async () => {
	const { runExecutionPreflight } = await loadExecutionHelpersModule();

	const result = runExecutionPreflight({
		preview: {
			fromChain: 8453,
			toChain: 8453,
			quote: {
				action: {
					fromAmount: '5000000',
					fromToken: { address: '0xusdc', symbol: 'USDC' },
				},
				estimate: {
					approvalAddress: '0xapproval',
					gasCosts: [{ amount: '1000', amountUSD: '0.02', token: { symbol: 'ETH' } }],
				},
				transactionRequest: { to: '0xrouter', data: '0x1234' },
			},
		},
		wallet: {
			address: '0xuser',
			chainId: 8453,
			nativeBalance: 999n,
			allowance: 5000000n,
		},
	});

	assert.equal(result.ready, false);
	assert.equal(result.reason, 'blocked_insufficient_gas');
	assert.equal(result.nativeGasSufficient, false);
});

test('runExecutionPreflight marks allowance shortfall as requiring approval instead of blocking', async () => {
	const { runExecutionPreflight } = await loadExecutionHelpersModule();

	const result = runExecutionPreflight({
		preview: {
			fromChain: 8453,
			toChain: 8453,
			quote: {
				action: {
					fromAmount: '5000000',
					fromToken: { address: '0xusdc', symbol: 'USDC' },
				},
				estimate: {
					approvalAddress: '0xapproval',
					gasCosts: [{ amount: '1000', amountUSD: '0.02', token: { symbol: 'ETH' } }],
				},
				transactionRequest: { to: '0xrouter', data: '0x1234' },
			},
		},
		wallet: {
			address: '0xuser',
			chainId: 8453,
			nativeBalance: 5000n,
			allowance: 4999999n,
		},
	});

	assert.equal(result.ready, true);
	assert.equal(result.requiresApproval, true);
	assert.equal(result.allowanceSufficient, false);
	assert.equal(result.amountBaseUnits, 5000000n);
});

test('runExecutionPreflight allows supported cross-chain source transactions', async () => {
	const { runExecutionPreflight } = await loadExecutionHelpersModule();

	const result = runExecutionPreflight({
		preview: {
			fromChain: 8453,
			toChain: 42161,
			quote: {
				action: {
					fromAmount: '5000000',
					fromToken: { address: '0xusdc', symbol: 'USDC' },
				},
				estimate: {
					approvalAddress: '0xapproval',
					gasCosts: [{ amount: '1000', amountUSD: '0.02', token: { symbol: 'ETH' } }],
				},
				transactionRequest: { to: '0xrouter', data: '0x1234' },
			},
		},
		wallet: {
			address: '0xuser',
			chainId: 8453,
			nativeBalance: 5000n,
			allowance: 5000000n,
		},
	});

	assert.equal(result.ready, true);
	assert.equal(result.reason, null);
	assert.equal(result.allowanceSufficient, true);
});

test('runExecutionPreflight blocks unsupported cross-chain pairs deterministically', async () => {
	const { runExecutionPreflight } = await loadExecutionHelpersModule();

	const result = runExecutionPreflight({
		preview: {
			fromChain: 8453,
			toChain: 1,
			quote: {
				action: {
					fromAmount: '5000000',
					fromToken: { address: '0xusdc', symbol: 'USDC' },
				},
				estimate: {
					approvalAddress: '0xapproval',
					gasCosts: [{ amount: '1000', amountUSD: '0.02', token: { symbol: 'ETH' } }],
				},
				transactionRequest: { to: '0xrouter', data: '0x1234' },
			},
		},
		wallet: {
			address: '0xuser',
			chainId: 8453,
			nativeBalance: 5000n,
			allowance: 5000000n,
		},
	});

	assert.equal(result.ready, false);
	assert.equal(result.reason, 'blocked_unsupported_cross_chain_pair');
});

test('buildApproveRequest returns exact-amount ERC20 approve calldata', async () => {
	const { buildApproveRequest } = await loadExecutionHelpersModule();

	const request = buildApproveRequest({
		tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		spender: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
		amount: 5000000n,
	});

	assert.equal(request.to, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
	assert.equal(request.value, 0n);
	assert.match(request.data, /^0x095ea7b3/i);
});
