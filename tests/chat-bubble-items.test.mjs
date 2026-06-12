import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadChatBubbleItemsModule() {
	const sourcePath = path.resolve('./lib/chatBubbleItems.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-bubble-items-'));
	const outputPath = path.join(tempDir, 'chatBubbleItems.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('buildChatBubbleItems only exposes bubble-safe fields and keeps source message in extraInfo', async () => {
	const { buildChatBubbleItems } = await loadChatBubbleItemsModule();

	const [item] = buildChatBubbleItems(
		[
			{
				key: 'ai-1',
				role: 'ai',
				content: 'hello',
				reasoning: 'thinking',
				streaming: true,
				executionState: { status: 'idle' },
				executionPreview: { mode: 'recommend' },
				selectedVault: { id: 'vault-1' },
			},
		],
		(message) => `rendered:${message.content}`,
	);

	assert.deepEqual(Object.keys(item).sort(), [
		'content',
		'extraInfo',
		'key',
		'role',
	]);
	assert.equal(item.content, 'rendered:hello');
	assert.equal(item.extraInfo.reasoning, 'thinking');
	assert.equal(item.extraInfo.streaming, true);
	assert.deepEqual(item.extraInfo.executionState, { status: 'idle' });
	assert.deepEqual(item.extraInfo.executionPreview, { mode: 'recommend' });
	assert.deepEqual(item.extraInfo.selectedVault, { id: 'vault-1' });
});
