import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadPlannerPromptModule() {
	const sourcePath = path.resolve('./lib/plannerPrompt.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-prompt-'));
	const outputPath = path.join(tempDir, 'plannerPrompt.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('buildPlannerPrompt includes wallet address, wallet chain, current message, and recent history', async () => {
	const { buildPlannerPrompt } = await loadPlannerPromptModule();

	const prompt = buildPlannerPrompt({
		userAddress: '0x1111111111111111111111111111111111111111',
		walletChainId: 8453,
		userMessage: 'find the best vault on base',
		messages: [
			{ role: 'user', content: 'previous question' },
			{ role: 'ai', content: 'previous answer' },
		],
	});

	assert.match(prompt, /Wallet address: 0x1111111111111111111111111111111111111111/);
	assert.match(prompt, /Wallet chain: 8453/);
	assert.match(prompt, /Current message: find the best vault on base/);
	assert.match(prompt, /user: previous question/);
	assert.match(prompt, /ai: previous answer/);
});
