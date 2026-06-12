import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadMainAgentModule() {
	return loadTsModule('./app/api/agents/agents/main.ts');
}

test('resolveEffectiveIntentForMode keeps intent lens mode intents-first', async () => {
	const { resolveEffectiveIntentForMode } = await loadMainAgentModule();

	const intent = resolveEffectiveIntentForMode({
		mode: 'intent_lens',
		planIntent: 'intent.transfer',
		detectedIntent: 'intent.transfer',
	});

	assert.equal(intent, 'intent.transfer');
});

test('resolveEffectiveIntentForMode routes classic mode to the classic earn agent', async () => {
	const { resolveEffectiveIntentForMode } = await loadMainAgentModule();

	const intent = resolveEffectiveIntentForMode({
		mode: 'classic_route',
		planIntent: 'intent.transfer',
		detectedIntent: 'intent.transfer',
	});

	assert.equal(intent, 'earn.deposit');
});
