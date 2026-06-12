import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadExecutionRuntimeModule() {
	return loadTsModule('./lib/executionRuntime.ts');
}

test('buildExecutionPreview requires amount before execution can proceed', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: null,
			sourceChain: 1,
			targetChain: 8453,
			minApy: 5,
			riskPreference: 'low',
			needsConfirmation: true,
			mode: 'recommend',
		},
		selectedVault: {
			address: '0xvault',
			chainId: 8453,
			name: 'RE7USDC',
			protocolName: 'morpho-v1',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 5.7,
			tvlUsd: 2051223,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: null,
	});

	assert.equal(preview.canExecute, false);
	assert.equal(preview.eligibility, 'blocked_missing_amount');
	assert.match(preview.blockingReason ?? '', /amount/i);
});

test('buildExecutionPreview treats zero amount as missing input instead of quote failure', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 0,
			sourceChain: 8453,
			targetChain: 8453,
			minApy: 5,
			riskPreference: 'medium',
			needsConfirmation: true,
			mode: 'recommend',
		},
		selectedVault: {
			address: '0xvault',
			chainId: 8453,
			name: 'USDC',
			protocolName: 'yo-protocol',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 16.47,
			tvlUsd: 27681375,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: null,
	});

	assert.equal(preview.canExecute, false);
	assert.equal(preview.eligibility, 'blocked_missing_amount');
	assert.equal(preview.fromAmount, null);
	assert.match(preview.blockingReason ?? '', /amount/i);
});

test('buildExecutionPreview summarizes quote values for live execution', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 500,
			sourceChain: 8453,
			targetChain: 8453,
			minApy: 5,
			riskPreference: 'low',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0xvault',
			chainId: 8453,
			name: 'RE7USDC',
			protocolName: 'morpho-v1',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 5.7,
			tvlUsd: 2051223,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: {
			action: {
				fromAmount: '500000000',
				fromToken: { address: '0xusdc', symbol: 'USDC' },
			},
			estimate: {
				approvalAddress: '0xapproval',
				toAmount: '498000000000000000000',
				toAmountMin: '497000000000000000000',
				executionDuration: 180,
				feeCosts: [{ amountUSD: '1.23' }],
				gasCosts: [{ amount: '1000', amountUSD: '0.12', token: { symbol: 'ETH' } }],
			},
			transactionRequest: {
				to: '0xrouter',
				data: '0x1234',
			},
			tool: 'composer',
		},
	});

	assert.equal(preview.canExecute, true);
	assert.equal(preview.eligibility, 'ready');
	assert.equal(preview.routeSource, 'live');
	assert.equal(preview.targetVault, 'RE7USDC');
	assert.equal(preview.fees, '$1.23');
	assert.equal(preview.executionKind, 'same_chain');
	assert.equal(preview.bridgeRequired, false);
	assert.equal(preview.statusTrackingScope, 'full_route');
});

test('buildExecutionPreview marks missing quote as blocked quote failure when amount is present', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 500,
			sourceChain: 8453,
			targetChain: 8453,
			minApy: 5,
			riskPreference: 'low',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0xvault',
			chainId: 42161,
			name: 'RE7USDC',
			protocolName: 'morpho-v1',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 5.7,
			tvlUsd: 2051223,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: null,
	});

	assert.equal(preview.canExecute, false);
	assert.equal(preview.eligibility, 'blocked_quote_failure');
	assert.match(preview.blockingReason ?? '', /quote/i);
});

test('buildExecutionPreview surfaces quote failure reasons when quote is unavailable', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 0.1,
			sourceChain: 8453,
			targetChain: 137,
			minApy: 3,
			riskPreference: 'medium',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0xpolygonvault',
			chainId: 137,
			name: 'USDC',
			protocolName: 'aave-v3',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 4.2,
			tvlUsd: 1000000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: null,
		quoteFailureReason:
			'Current Base -> Polygon demo blocks LI.FI routes that rely on relaydepository, fly, or custom intermediate steps.',
	});

	assert.equal(preview.canExecute, false);
	assert.equal(preview.eligibility, 'blocked_quote_failure');
	assert.match(preview.blockingReason ?? '', /Base -> Polygon/i);
	assert.match(preview.blockingReason ?? '', /relaydepository/i);
});

test('earning agent forwards raw quote failures into the execution preview builder', () => {
	const source = fs.readFileSync(
		path.resolve(
			'./app/api/agents/agents/earning.ts',
		),
		'utf8',
	);

	assert.match(
		source,
		/quoteFailureReason:\s*runtimeState\.quote\?\.success === false\s*\?\s*runtimeState\.quote\.error\s*:\s*undefined/,
	);
});

test('buildExecutionPreview allows supported cross-chain execution when LI.FI returns route data', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 25,
			sourceChain: 8453,
			targetChain: 42161,
			minApy: 4,
			riskPreference: 'low',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0x724dc807b04555b71ed48a6896b6f41593b8c637',
			chainId: 42161,
			name: 'USDC',
			protocolName: 'aave-v3',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 1.49,
			tvlUsd: 123000000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: {
			action: {
				fromToken: { address: '0xfrom', symbol: 'USDC' },
				fromAmount: '25000000',
			},
			estimate: {
				approvalAddress: '0xapproval',
				toAmount: '24000000000000000000',
				toAmountMin: '23900000000000000000',
				executionDuration: 60,
				feeCosts: [{ amountUSD: '0.45' }],
				gasCosts: [{ amountUSD: '0.11', amount: '100', token: { symbol: 'ETH' } }],
			},
			transactionRequest: {
				to: '0xrouter',
				data: '0x1234',
			},
			tool: 'stargateV2',
			toolDetails: { name: 'StargateV2 (Fast mode)' },
			includedSteps: [
				{
					tool: 'stargateV2',
					toolDetails: { name: 'StargateV2 (Fast mode)' },
					action: { fromChainId: 8453, toChainId: 42161 },
				},
				{
					tool: 'composer',
					toolDetails: { name: 'Composer' },
					action: { fromChainId: 42161, toChainId: 42161 },
				},
			],
		},
	});

	assert.equal(preview.canExecute, true);
	assert.equal(preview.eligibility, 'ready');
	assert.equal(preview.executionKind, 'cross_chain');
	assert.equal(preview.bridgeRequired, true);
	assert.equal(preview.destinationChainLabel, 'Arbitrum');
	assert.equal(preview.statusTrackingScope, 'source_tx_only');
	assert.deepEqual(preview.routeStepsSummary, [
		'Bridge from Base to Arbitrum with StargateV2 (Fast mode)',
		'Deposit into the target vault with Composer',
	]);
});

test('buildExecutionPreview supports Base to Polygon with Polygon route labeling', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 10,
			sourceChain: 8453,
			targetChain: 137,
			minApy: 3,
			riskPreference: 'medium',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0xpolygonvault',
			chainId: 137,
			name: 'USDC',
			protocolName: 'aave-v3',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 4.2,
			tvlUsd: 1000000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: {
			action: {
				fromToken: { address: '0xfrom', symbol: 'USDC' },
				fromAmount: '10000000',
			},
			estimate: {
				approvalAddress: '0xapproval',
				toAmount: '9800000',
				toAmountMin: '9700000',
				executionDuration: 90,
				feeCosts: [{ amountUSD: '0.50' }],
				gasCosts: [{ amountUSD: '0.12', amount: '100', token: { symbol: 'ETH' } }],
			},
			transactionRequest: {
				to: '0xrouter',
				data: '0x1234',
			},
			tool: 'stargateV2',
			toolDetails: { name: 'StargateV2 (Fast mode)' },
			includedSteps: [
				{
					tool: 'stargateV2',
					toolDetails: { name: 'StargateV2 (Fast mode)' },
					action: { fromChainId: 8453, toChainId: 137 },
				},
				{
					tool: 'composer',
					toolDetails: { name: 'Composer' },
					action: { fromChainId: 137, toChainId: 137 },
				},
			],
		},
	});

	assert.equal(preview.canExecute, true);
	assert.equal(preview.eligibility, 'ready');
	assert.equal(preview.executionKind, 'cross_chain');
	assert.equal(preview.bridgeRequired, true);
	assert.equal(preview.destinationChainLabel, 'Polygon');
	assert.equal(preview.statusTrackingScope, 'source_tx_only');
	assert.deepEqual(preview.routeStepsSummary, [
		'Bridge from Base to Polygon with StargateV2 (Fast mode)',
		'Deposit into the target vault with Composer',
	]);
});

test('buildExecutionPreview blocks unsupported cross-chain pairs before wallet execution', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 25,
			sourceChain: 8453,
			targetChain: 1,
			minApy: 4,
			riskPreference: 'low',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0xvault',
			chainId: 1,
			name: 'USDC',
			protocolName: 'aave-v3',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 1.2,
			tvlUsd: 50000000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: null,
	});

	assert.equal(preview.canExecute, false);
	assert.equal(preview.eligibility, 'blocked_unsupported_cross_chain_pair');
	assert.match(preview.blockingReason ?? '', /not enabled/i);
});

test('buildExecutionPreview blocks execution when approval target is missing', async () => {
	const { buildExecutionPreview } = await loadExecutionRuntimeModule();

	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: 5,
			sourceChain: 8453,
			targetChain: 8453,
			minApy: 4,
			riskPreference: 'low',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: '0xvault',
			chainId: 8453,
			name: 'STEAKUSDC',
			protocolName: 'morpho-v1',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 3.83,
			tvlUsd: 482000000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		quote: {
			action: {
				fromToken: { address: '0xfrom', symbol: 'USDC' },
				fromAmount: '5000000',
			},
			estimate: {
				toAmount: '4800000000000000000',
				toAmountMin: '4780000000000000000',
				executionDuration: 0,
				feeCosts: [{ amountUSD: '0.01' }],
				gasCosts: [{ amountUSD: '0.02', amount: '200', token: { symbol: 'ETH' } }],
			},
			transactionRequest: {
				to: '0xrouter',
				data: '0x1234',
			},
			tool: 'composer',
		},
	});

	assert.equal(preview.canExecute, false);
	assert.equal(preview.eligibility, 'blocked_missing_approval_target');
	assert.match(preview.blockingReason ?? '', /approval/i);
});
