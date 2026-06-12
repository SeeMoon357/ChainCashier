import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadExecutionErrorsModule() {
	return loadTsModule('./lib/executionErrors.ts');
}

test('normalizeExecutionError explains LI.FI Intents escrow simulation failures', async () => {
	const { normalizeExecutionError } = await loadExecutionErrorsModule();

	const normalized = normalizeExecutionError(
		new Error('LI.FI Intents escrow open transaction reverted during gas simulation.'),
	);

	assert.equal(normalized.errorCode, 'intent_escrow_simulation_failed');
	assert.match(normalized.error, /not open the wallet/i);
	assert.match(normalized.error, /order encoding/i);
});
