import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
	path.resolve('./components/ChainCashierChat.tsx'),
	'utf8',
);

test('payer quote updates do not attach a duplicate invoice card to the assistant bubble', () => {
	assert.match(
		source,
		/if \(role === 'merchant'\) \{\s*deferAssistantPatch\(aiId, \{ invoice: payload\.invoice \}\);\s*\}/s,
	);
});

test('streaming indicator uses an animated spinner', () => {
	assert.match(source, /<CircleDashed className='h-3 w-3 animate-spin' \/>/);
});
