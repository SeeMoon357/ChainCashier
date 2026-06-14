import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('./components/LandingHero.tsx'), 'utf8');
const pitchRoute = fs.readFileSync(path.resolve('./app/pitch/route.ts'), 'utf8');
const pitchHtml = fs.readFileSync(path.resolve('./public/pitch/index.html'), 'utf8');

test('home page presents ChainCashier hackathon story and chat entry', () => {
	assert.match(source, /Chat-to-Pay/);
	assert.match(source, /GLM-5\.1/);
	assert.match(source, /LI\.FI/);
	assert.match(source, /receipt hash/i);
	assert.match(source, /href='\/chat'/);
	assert.match(source, /href='\/pitch\/'/);
	assert.match(source, /Pitch Deck/);
});

test('pitch deck is served from public static files', () => {
	assert.ok(fs.existsSync(path.resolve('./public/pitch/index.html')));
	assert.ok(fs.existsSync(path.resolve('./public/pitch/1.jpg')));
	assert.ok(fs.existsSync(path.resolve('./public/pitch/2.jpg')));
	assert.match(pitchHtml, /src="\/pitch\/1\.jpg"/);
	assert.match(pitchHtml, /src="\/pitch\/2\.jpg"/);
	assert.match(pitchRoute, /public', 'pitch', 'index\.html/);
	assert.match(pitchRoute, /content-type': 'text\/html; charset=utf-8/);
});
