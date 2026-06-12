import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function loadConversationRuntimeModule() {
	const sourcePath = path.resolve('./lib/conversationRuntime.ts');
	const source = fs.readFileSync(sourcePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: sourcePath,
	});

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-runtime-'));
	const outputPath = path.join(tempDir, 'conversationRuntime.mjs');
	fs.writeFileSync(outputPath, outputText, 'utf8');
	return import(pathToFileURL(outputPath).href);
}

test('createOrReusePendingConversation inserts a visible draft conversation immediately', async () => {
	const {
		createOrReusePendingConversation,
		DEFAULT_CONVERSATION_TITLE,
	} = await loadConversationRuntimeModule();

	const result = createOrReusePendingConversation({
		conversations: [
			{ key: 'conv-1', title: 'Existing', createdAt: '2026-03-28T18:42:00' },
		],
		pendingConversation: null,
		nextKey: 'conv-2',
		createdAt: '2026-04-13T10:00:00.000Z',
	});

	assert.equal(result.activeKey, 'conv-2');
	assert.equal(result.pendingConversation?.key, 'conv-2');
	assert.equal(result.conversations[0]?.key, 'conv-2');
	assert.equal(result.conversations[0]?.title, DEFAULT_CONVERSATION_TITLE);
	assert.equal(result.reused, false);
});

test('createOrReusePendingConversation reuses the existing draft instead of duplicating it', async () => {
	const { createOrReusePendingConversation } =
		await loadConversationRuntimeModule();

	const result = createOrReusePendingConversation({
		conversations: [
			{
				key: 'conv-3',
				title: 'New conversation',
				createdAt: '2026-04-13T10:00:00.000Z',
			},
			{ key: 'conv-1', title: 'Existing', createdAt: '2026-03-28T18:42:00' },
		],
		pendingConversation: {
			key: 'conv-3',
			createdAt: '2026-04-13T10:00:00.000Z',
		},
		nextKey: 'conv-4',
		createdAt: '2026-04-13T10:05:00.000Z',
	});

	assert.equal(result.activeKey, 'conv-3');
	assert.equal(result.pendingConversation?.key, 'conv-3');
	assert.equal(result.conversations.length, 2);
	assert.equal(result.reused, true);
});

test('applyFirstMessageToPendingConversation promotes the first user message into the draft title', async () => {
	const { applyFirstMessageToPendingConversation } =
		await loadConversationRuntimeModule();

	const result = applyFirstMessageToPendingConversation({
		conversations: [
			{
				key: 'conv-3',
				title: 'New conversation',
				createdAt: '2026-04-13T10:00:00.000Z',
			},
			{ key: 'conv-1', title: 'Existing', createdAt: '2026-03-28T18:42:00' },
		],
		pendingConversation: {
			key: 'conv-3',
			createdAt: '2026-04-13T10:00:00.000Z',
		},
		text: 'Move 10 USDC from Base into the best USDC vault on Arbitrum',
	});

	assert.equal(result.updated, true);
	assert.equal(result.pendingConversation, null);
	assert.equal(result.activeKey, 'conv-3');
	assert.match(
		result.conversations[0]?.title ?? '',
		/^Move 10 USDC from Base into/,
	);
});
