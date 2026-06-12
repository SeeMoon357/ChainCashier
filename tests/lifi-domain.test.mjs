import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadLifiDomainModule() {
	return loadTsModule('./lib/lifiDomain.ts');
}

test('renderEarnRecommendation adds destination gas disclaimer for cross-chain Polygon routes', async () => {
	const { renderEarnRecommendation } = await loadLifiDomainModule();

	const text = renderEarnRecommendation({
		chainName: 'Polygon',
		dataSource: 'live',
		selectedVault: {
			address: '0xvault',
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
		alternatives: [],
		portfolioPositions: [],
		plan: {
			amount: 10,
			sourceChain: 8453,
			targetChain: 137,
			minApy: null,
			riskPreference: 'medium',
			mode: 'execute',
		},
		executionPreview: {
			canExecute: true,
			blockingReason: null,
			fees: '$0.25',
			routeSource: 'live',
			executionDurationSeconds: 75,
			executionKind: 'cross_chain',
			bridgeRequired: true,
			destinationChainLabel: 'Polygon',
			routeStepsSummary: ['Bridge from Base to Polygon', 'Deposit into the target vault'],
			statusTrackingScope: 'source_tx_only',
		},
		thresholdSatisfied: true,
	});

	assert.match(text, /destination-chain gas refueling/i);
	assert.match(text, /may still need POL/i);
});

test('lifiDomain no longer exposes route guard helpers for Base to Polygon deny logic', async () => {
	const lifiDomain = await loadLifiDomainModule();

	assert.equal(lifiDomain.getQuoteRouteGuardParams, undefined);
	assert.equal(lifiDomain.assessQuoteRouteRisk, undefined);
});
