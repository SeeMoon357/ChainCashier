import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadAgentStepsModule() {
	const sourcePath = path.resolve('./lib/agentSteps.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-steps-'));
	const outputPath = path.join(tempDir, 'agentSteps.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('createAgentStepEvent uses stable titles for supported earn step keys', async () => {
	const { createAgentStepEvent } = await loadAgentStepsModule();

	const event = createAgentStepEvent('vault_search', 'running', 'Searching Base vaults');

	assert.deepEqual(event, {
		type: 'step',
		key: 'vault_search',
		title: 'Vault Search',
		status: 'running',
		summary: 'Searching Base vaults',
	});
});

test('upsertAgentStep updates an existing step instead of duplicating it', async () => {
	const { createAgentStepEvent, upsertAgentStep } = await loadAgentStepsModule();

	const initial = [
		createAgentStepEvent('planning', 'completed', 'Plan ready'),
		createAgentStepEvent('vault_search', 'running', 'Searching live vaults'),
	];

	const updated = upsertAgentStep(
		initial,
		createAgentStepEvent('vault_search', 'completed', 'Found 3 matching vaults'),
	);

	assert.equal(updated.length, 2);
	assert.deepEqual(updated[1], {
		type: 'step',
		key: 'vault_search',
		title: 'Vault Search',
		status: 'completed',
		summary: 'Found 3 matching vaults',
	});
});
