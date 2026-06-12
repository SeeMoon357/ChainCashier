import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('getModelFromConfig creates a DeepSeek OpenAI-compatible v1 model', async () => {
	const { getModelFromConfig } = await loadTsModule('./lib/agentClient.ts');
	process.env.DEEPSEEK_API_KEY = 'test-key';
	delete process.env.DEEPSEEK_BASE_URL;

	const model = getModelFromConfig({
		name: 'Test DeepSeek',
		model: 'deepseek-v4-pro',
		provider: 'deepseek',
		apiKeyEnv: 'DEEPSEEK_API_KEY',
	});

	assert.equal(model.specificationVersion, 'v1');
	assert.equal(model.provider, 'deepseek.chat');

	delete process.env.DEEPSEEK_API_KEY;
});
