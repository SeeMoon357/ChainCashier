import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('./components/LandingHero.tsx'), 'utf8');

test('home page presents ChainCashier hackathon story and chat entry', () => {
	assert.match(source, /Chat-to-Pay/);
	assert.match(source, /GLM-5\.1/);
	assert.match(source, /LI\.FI/);
	assert.match(source, /receipt hash/i);
	assert.match(source, /href='\/chat'/);
});
