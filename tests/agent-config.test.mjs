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

test('getAgentConfig defaults all core agents to Z.AI GLM-5.1', async () => {
	const { getAgentConfig } = await loadAgentConfigModule();
	delete process.env.MAIN_AGENT_MODEL;
	delete process.env.EARNING_AGENT_MODEL;
	delete process.env.BRIDGE_AGENT_MODEL;
	delete process.env.RISK_AGENT_MODEL;
	delete process.env.MONITOR_AGENT_MODEL;
	delete process.env.CHECKOUT_AGENT_MODEL;

	const main = getAgentConfig('main');
	const earning = getAgentConfig('earning');
	const bridge = getAgentConfig('bridge');
	const risk = getAgentConfig('risk');
	const monitor = getAgentConfig('monitor');
	const checkout = getAgentConfig('checkout');

	for (const config of [main, earning, bridge, risk, monitor, checkout]) {
		assert.equal(config.provider, 'zai');
		assert.equal(config.model, 'glm-5.1');
		assert.equal(config.apiKeyEnv, 'ZAI_API_KEY');
	}
});

test('getAgentConfig maps explicit zai provider config to ZAI_API_KEY', async () => {
	const { getAgentConfig } = await loadAgentConfigModule();
	process.env.CHECKOUT_AGENT_MODEL = 'zai/glm-5.1';

	const checkout = getAgentConfig('checkout');

	assert.equal(checkout.provider, 'zai');
	assert.equal(checkout.model, 'glm-5.1');
	assert.equal(checkout.apiKeyEnv, 'ZAI_API_KEY');

	delete process.env.CHECKOUT_AGENT_MODEL;
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
