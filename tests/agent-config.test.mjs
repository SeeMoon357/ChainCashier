import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadAgentConfigModule() {
	const sourcePath = path.resolve('./lib/agentConfig.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-'));
	const outputPath = path.join(tempDir, 'agentConfig.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('getAgentConfig maps explicit qwen provider config to QWEN_API_KEY', async () => {
	const { getAgentConfig } = await loadAgentConfigModule();
	process.env.MAIN_AGENT_MODEL = 'qwen/qwen3.5-plus';

	const config = getAgentConfig('main');

	assert.equal(config.provider, 'qwen');
	assert.equal(config.model, 'qwen3.5-plus');
	assert.equal(config.apiKeyEnv, 'QWEN_API_KEY');

	delete process.env.MAIN_AGENT_MODEL;
});

test('getAgentConfig defaults main and earning agents to DeepSeek Pro', async () => {
	const { getAgentConfig } = await loadAgentConfigModule();
	delete process.env.MAIN_AGENT_MODEL;
	delete process.env.EARNING_AGENT_MODEL;

	const main = getAgentConfig('main');
	const earning = getAgentConfig('earning');

	assert.equal(main.provider, 'deepseek');
	assert.equal(main.model, 'deepseek-v4-pro');
	assert.equal(main.apiKeyEnv, 'DEEPSEEK_API_KEY');
	assert.equal(earning.provider, 'deepseek');
	assert.equal(earning.model, 'deepseek-v4-pro');
	assert.equal(earning.apiKeyEnv, 'DEEPSEEK_API_KEY');
});

test('getAgentConfig maps explicit deepseek provider config to DEEPSEEK_API_KEY', async () => {
	const { getAgentConfig } = await loadAgentConfigModule();
	process.env.MAIN_AGENT_MODEL = 'deepseek/deepseek-v4-pro';

	const config = getAgentConfig('main');

	assert.equal(config.provider, 'deepseek');
	assert.equal(config.model, 'deepseek-v4-pro');
	assert.equal(config.apiKeyEnv, 'DEEPSEEK_API_KEY');

	delete process.env.MAIN_AGENT_MODEL;
});

test('getAgentConfig maps legacy qwen model names to QWEN_API_KEY', async () => {
	const { getAgentConfig } = await loadAgentConfigModule();
	process.env.EARNING_AGENT_MODEL = 'qwen-plus';

	const config = getAgentConfig('earning');

	assert.equal(config.provider, 'qwen');
	assert.equal(config.apiKeyEnv, 'QWEN_API_KEY');

	delete process.env.EARNING_AGENT_MODEL;
});
