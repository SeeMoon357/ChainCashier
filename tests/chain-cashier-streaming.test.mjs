import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('splitTypewriterText breaks paragraphs into small readable tokens', async () => {
	const { splitTypewriterText } = await loadTsModule(
		'./lib/chainCashierStreaming.ts',
	);

	const tokens = splitTypewriterText('收到。商户将收到 20 USDC on Base。\n\n付款链接：https://example.test/pay/INV-1');

	assert.ok(tokens.length > 10);
	assert.equal(tokens.join(''), '收到。商户将收到 20 USDC on Base。\n\n付款链接：https://example.test/pay/INV-1');
	assert.ok(tokens.every((token) => token.length <= 8));
	assert.deepEqual(tokens.slice(0, 3), ['收', '到', '。']);
	assert.ok(tokens.includes('\n\n'));
	assert.ok(tokens.includes('USDC '));
});
