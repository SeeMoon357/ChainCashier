import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadLifiClientModule() {
	const sourcePath = path.resolve('./lib/lifiClient.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifi-client-'));
	const outputPath = path.join(tempDir, 'lifiClient.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('createLifiClient builds the earn vaults request with the expected query params', async () => {
	const calls = [];
	const { createLifiClient } = await loadLifiClientModule();
	const client = createLifiClient(async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify({ data: [], total: 0 }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	});

	const result = await client.getVaults({
		chainId: 8453,
		underlyingTokens: 'USDC',
		limit: 25,
	});

	assert.equal(result.success, true);
	assert.equal(calls.length, 1);
	assert.match(calls[0].url, /https:\/\/earn\.li\.fi\/v1\/earn\/vaults\?/);
	assert.match(calls[0].url, /chainId=8453/);
	assert.match(calls[0].url, /underlyingTokens=USDC/);
	assert.match(calls[0].url, /limit=25/);
	assert.equal(calls[0].init?.cache, 'no-store');
});

test('createLifiClient builds the quote request against li.quest', async () => {
	const calls = [];
	const { createLifiClient } = await loadLifiClientModule();
	const client = createLifiClient(async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify({ transactionRequest: {} }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	});

	const result = await client.getQuote({
		fromChain: 1,
		toChain: 8453,
		fromToken: '0xfrom',
		toToken: '0xto',
		fromAmount: '500000000',
		fromAddress: '0x1111111111111111111111111111111111111111',
		toAddress: '0x1111111111111111111111111111111111111111',
	});

	assert.equal(result.success, true);
	assert.equal(calls.length, 1);
	assert.match(calls[0].url, /https:\/\/li\.quest\/v1\/quote\?/);
	assert.match(calls[0].url, /fromChain=1/);
	assert.match(calls[0].url, /toChain=8453/);
	assert.match(calls[0].url, /fromAmount=500000000/);
	assert.equal(calls[0].init?.cache, 'no-store');
});

test('createLifiClient builds the status request against li.quest', async () => {
	const calls = [];
	const { createLifiClient } = await loadLifiClientModule();
	const client = createLifiClient(async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(
			JSON.stringify({
				status: 'DONE',
				substatus: 'REFUNDED',
			}),
			{
				status: 200,
				headers: { 'content-type': 'application/json' },
			},
		);
	});

	const result = await client.getStatus({
		txHash: '0xabc',
		fromChain: 8453,
		toChain: 137,
		bridge: 'relaydepository',
	});

	assert.equal(result.success, true);
	assert.equal(calls.length, 1);
	assert.match(calls[0].url, /https:\/\/li\.quest\/v1\/status\?/);
	assert.match(calls[0].url, /txHash=0xabc/);
	assert.match(calls[0].url, /fromChain=8453/);
	assert.match(calls[0].url, /toChain=137/);
	assert.match(calls[0].url, /bridge=relaydepository/);
	assert.equal(calls[0].init?.cache, 'no-store');
});

test('createLifiClient includes the server-side LI.FI API key header when configured', async () => {
	const calls = [];
	process.env.LIFI_API_KEY = 'server-secret';

	const { createLifiClient } = await loadLifiClientModule();
	const client = createLifiClient(async (url, init) => {
		calls.push({ url: String(url), init });
		return new Response(JSON.stringify({ data: [], total: 0 }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	});

	await client.getVaults({
		chainId: 8453,
		underlyingTokens: 'USDC',
		limit: 25,
	});

	assert.equal(calls.length, 1);
	assert.equal(calls[0].init?.headers?.['x-lifi-api-key'], 'server-secret');

	delete process.env.LIFI_API_KEY;
});
