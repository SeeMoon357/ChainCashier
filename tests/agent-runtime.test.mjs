import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadAgentRuntimeModule() {
	const sourcePath = path.resolve('./lib/agentRuntime.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-runtime-'));
	const outputPath = path.join(tempDir, 'agentRuntime.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('normalizeAgentRequest rejects requests when wallet address is missing', async () => {
	const { normalizeAgentRequest } = await loadAgentRuntimeModule();

	const result = normalizeAgentRequest({
		message: '帮我找收益最高的 vault',
	});

	assert.equal(result.ok, false);
	assert.match(result.error, /userAddress/i);
});

test('normalizeAgentRequest rejects empty messages', async () => {
	const { normalizeAgentRequest } = await loadAgentRuntimeModule();

	const result = normalizeAgentRequest({
		message: '   ',
		userAddress: '0x1111111111111111111111111111111111111111',
	});

	assert.equal(result.ok, false);
	assert.match(result.error, /message/i);
});

test('getQwenBaseUrl prefers explicit QWEN_BASE_URL and otherwise uses the official default', async () => {
	const { getQwenBaseUrl, DEFAULT_QWEN_BASE_URL } =
		await loadAgentRuntimeModule();

	assert.equal(
		getQwenBaseUrl({
			QWEN_BASE_URL: 'https://custom.example.com/v1',
			BASE_URL: 'https://fallback.example.com/v1',
		}),
		'https://custom.example.com/v1',
	);

	assert.equal(
		getQwenBaseUrl({
			QWEN_BASE_URL: '',
			BASE_URL: '',
		}),
		DEFAULT_QWEN_BASE_URL,
	);
});

test('normalizeAgentRequest accepts messages and walletChainId when present', async () => {
	const { normalizeAgentRequest } = await loadAgentRuntimeModule();

	const result = normalizeAgentRequest({
		message: 'find the best vault on Arbitrum',
		userAddress: '0x1111111111111111111111111111111111111111',
		walletChainId: 42161,
		mode: 'classic_route',
		messages: [
			{ role: 'user', content: 'find vaults' },
			{ role: 'ai', content: 'here are top picks' },
		],
	});

	assert.equal(result.ok, true);
	assert.equal(result.value.chainId, 42161);
	assert.equal(result.value.walletChainId, 42161);
	assert.equal(result.value.mode, 'classic_route');
	assert.deepEqual(result.value.messages, [
		{ role: 'user', content: 'find vaults' },
		{ role: 'ai', content: 'here are top picks' },
	]);
});

test('normalizeAgentRequest tolerates empty messages array and falls back to chainId', async () => {
	const { normalizeAgentRequest } = await loadAgentRuntimeModule();

	const result = normalizeAgentRequest({
		message: 'find vaults',
		userAddress: '0x1111111111111111111111111111111111111111',
		chainId: 8453,
		messages: [],
	});

	assert.equal(result.ok, true);
	assert.equal(result.value.walletChainId, 8453);
	assert.equal(result.value.mode, 'intent_lens');
	assert.deepEqual(result.value.messages, []);
});

test('normalizeAgentRequest falls back to intent mode for invalid mode values', async () => {
	const { normalizeAgentRequest } = await loadAgentRuntimeModule();

	const result = normalizeAgentRequest({
		message: 'send USDC',
		userAddress: '0x1111111111111111111111111111111111111111',
		mode: 'surprise-mode',
	});

	assert.equal(result.ok, true);
	assert.equal(result.value.mode, 'intent_lens');
});
