import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
	path.resolve('./components/ChainCashierChat.tsx'),
	'utf8',
);
const chatRouteSource = fs.readFileSync(
	path.resolve('./app/api/chaincashier/chat/route.ts'),
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

test('empty streaming assistant bubbles keep showing a loading indicator even when reasoning exists', () => {
	assert.match(source, /message\.streaming \? \(\s*<LoadingIndicator \/>/s);
	assert.match(source, /message\.streaming && message\.content \? \(/);
});

test('payer checkout user-facing text is localized to Chinese', () => {
	assert.doesNotMatch(chatRouteSource, /Received\. The merchant requests/);
	assert.doesNotMatch(chatRouteSource, /You selected .* as the payer source/);
	assert.doesNotMatch(chatRouteSource, /Agent never signs or transfers funds/);
	assert.match(chatRouteSource, /收到。商户要求收到/);
	assert.match(source, /付款人预计支付/);
	assert.match(source, /用钱包授权并付款/);
});

test('merchant invoice and quote responses use Chinese agent-facing copy', () => {
	assert.doesNotMatch(chatRouteSource, /Done\. I created the payment invoice/);
	assert.doesNotMatch(chatRouteSource, /LI\.FI 已选择最快的稳定币路线/);
	assert.match(chatRouteSource, /我已创建收款账单/);
	assert.match(chatRouteSource, /Agent 已基于快速稳定币路线策略/);
});

test('invoice card exposes a compact copy payment link button', () => {
	assert.match(source, /aria-label='复制付款链接'/);
	assert.match(source, /navigator\.clipboard\.writeText\(invoice\.paymentLink\)/);
});

test('receipt card exposes scan links and receipt evidence labels', () => {
	assert.match(source, /getChainCashierExplorerTxUrl/);
	assert.match(source, /function ReceiptCard\(\{[\s\S]*invoice[\s\S]*\}: \{[\s\S]*invoice\?: Invoice/);
	assert.match(source, /<ReceiptCard receipt=\{message\.receipt\} supportPackage=\{message\.supportPackage\} invoice=\{message\.invoice\} \/>/);
	assert.match(source, /付款链交易/);
	assert.match(source, /收款链交易/);
	assert.match(source, /LI\.FI 状态/);
	assert.match(source, /Receipt hash/);
});

test('long wallet and route evidence wraps inside cards', () => {
	assert.match(source, /className='rounded-md border border-slate-200 bg-white p-2 break-all'/);
	assert.match(source, /className='mt-1 break-all text-xs text-slate-500'/);
	assert.match(source, /formatWalletErrorMessage/);
});
