import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadLifiRuntimeModule() {
	const sourcePath = path.resolve('./lib/lifiRuntime.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifi-runtime-'));
	const outputPath = path.join(tempDir, 'lifiRuntime.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('normalizeVaultListResponse reads LI.FI wrapped data payloads', async () => {
	const { normalizeVaultListResponse } = await loadLifiRuntimeModule();

	const result = normalizeVaultListResponse({
		data: [
			{
				address: '0xvault',
				chainId: 8453,
				name: 'RE7USDC',
				protocol: { name: 'morpho-v1' },
				underlyingTokens: [{ symbol: 'USDC', address: '0xusdc', decimals: 6 }],
				tags: ['stablecoin'],
				isTransactional: true,
				isRedeemable: true,
				analytics: {
					apy: { total: 5.71 },
					tvl: { usd: '2051223' },
				},
			},
		],
		total: 1,
	});

	assert.equal(result.success, true);
	assert.equal(result.vaults.length, 1);
	assert.deepEqual(result.vaults[0], {
		address: '0xvault',
		chainId: 8453,
		name: 'RE7USDC',
		protocolName: 'morpho-v1',
		underlyingSymbol: 'USDC',
		underlyingTokenAddress: '0xusdc',
		apyTotal: 5.71,
		tvlUsd: 2051223,
		tags: ['stablecoin'],
		isTransactional: true,
		isRedeemable: true,
		dataSource: 'live',
	});
});

test('normalizeVaultListResponse rejects invalid payloads without assuming array methods', async () => {
	const { normalizeVaultListResponse } = await loadLifiRuntimeModule();

	assert.deepEqual(normalizeVaultListResponse({ error: 'bad payload' }), {
		success: false,
		errorCode: 'vault_list_payload_invalid',
		error: 'bad payload',
		vaults: [],
	});
});

test('normalizeVaultDetailResponse reads a single live vault record', async () => {
	const { normalizeVaultDetailResponse } = await loadLifiRuntimeModule();

	const vault = normalizeVaultDetailResponse({
		address: '0xvaultdetail',
		chainId: 42161,
		name: 'USDC',
		protocol: { name: 'yo-protocol' },
		underlyingTokens: [{ symbol: 'USDC', address: '0xusdc', decimals: 6 }],
		tags: ['stablecoin'],
		isTransactional: true,
		isRedeemable: true,
		analytics: {
			apy: { total: 6.1 },
			tvl: { usd: '1234567' },
		},
	});

	assert.deepEqual(vault, {
		address: '0xvaultdetail',
		chainId: 42161,
		name: 'USDC',
		protocolName: 'yo-protocol',
		underlyingSymbol: 'USDC',
		underlyingTokenAddress: '0xusdc',
		apyTotal: 6.1,
		tvlUsd: 1234567,
		tags: ['stablecoin'],
		isTransactional: true,
		isRedeemable: true,
		dataSource: 'live',
	});
});

test('rankVaultCandidates prefers eligible live transactional USDC vaults', async () => {
	const { rankVaultCandidates } = await loadLifiRuntimeModule();

	const ranked = rankVaultCandidates([
		{
			address: '0x1',
			chainId: 8453,
			name: 'Low APY',
			protocolName: 'alpha',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 4.2,
			tvlUsd: 1000000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		{
			address: '0x2',
			chainId: 8453,
			name: 'Best APY',
			protocolName: 'beta',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 5.6,
			tvlUsd: 900000,
			tags: ['stablecoin'],
			isTransactional: true,
			isRedeemable: true,
			dataSource: 'live',
		},
		{
			address: '0x3',
			chainId: 8453,
			name: 'Non transactional',
			protocolName: 'gamma',
			underlyingSymbol: 'USDC',
			underlyingTokenAddress: '0xusdc',
			apyTotal: 9.8,
			tvlUsd: 2000000,
			tags: ['stablecoin'],
			isTransactional: false,
			isRedeemable: true,
			dataSource: 'live',
		},
	], {
		minApy: 5,
		limit: 2,
	});

	assert.deepEqual(
		ranked.map((vault) => vault.address),
		['0x2', '0x1'],
	);
});

test('buildRecommendationSummary marks fallback output explicitly', async () => {
	const { buildRecommendationSummary } = await loadLifiRuntimeModule();

	const text = buildRecommendationSummary({
		chainName: 'Base',
		dataSource: 'fallback',
		fallbackReason: 'Live vault list was unavailable.',
		selectedVault: null,
		alternatives: [],
	});

	assert.match(text, /Source: fallback/i);
	assert.match(text, /Live vault list was unavailable/i);
});

test('buildVaultDisplayName expands generic underlying-only vault names', async () => {
	const { buildVaultDisplayName } = await loadLifiRuntimeModule();

	assert.equal(
		buildVaultDisplayName({
			name: 'USDC',
			protocolName: 'yo-protocol',
			underlyingSymbol: 'USDC',
		}),
		'USDC vault on yo-protocol',
	);

	assert.equal(
		buildVaultDisplayName({
			name: 'RE7USDC',
			protocolName: 'morpho-v1',
			underlyingSymbol: 'USDC',
		}),
		'RE7USDC',
	);
});

test('summarizeVaultSearchOutcome explains when live data exists but token matches are empty', async () => {
	const { summarizeVaultSearchOutcome } = await loadLifiRuntimeModule();

	const summary = summarizeVaultSearchOutcome({
		chainName: 'Base',
		token: 'USDC',
		totalVaultCount: 10,
		matchingTokenCount: 0,
		transactionalCount: 0,
		selectedVault: null,
	});

	assert.match(summary, /live vault data was returned on Base/i);
	assert.match(summary, /matched USDC/i);
});

test('summarizeVaultSearchOutcome explains when local ranking fails despite transactional matches', async () => {
	const { summarizeVaultSearchOutcome } = await loadLifiRuntimeModule();

	const summary = summarizeVaultSearchOutcome({
		chainName: 'Base',
		token: 'USDC',
		totalVaultCount: 8,
		matchingTokenCount: 3,
		transactionalCount: 2,
		selectedVault: null,
	});

	assert.match(summary, /local ranking did not produce a candidate/i);
});
