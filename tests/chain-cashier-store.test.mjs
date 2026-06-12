import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('chain cashier store persists invoices to a local JSON file', async () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaincashier-store-'));
	const storePath = path.join(tempDir, 'invoices.json');
	process.env.CHAINCASHIER_STORE_PATH = storePath;

	const cashier = await loadTsModule('./lib/chainCashier.ts');
	const store = await loadTsModule('./lib/chainCashierStore.ts');
	const invoice = cashier.createInvoiceFromAgentOutput({
		merchantAddress: '0x1111111111111111111111111111111111111111',
		origin: 'http://localhost:3000',
		agentOutput: {
			invoice: {
				receiveChain: 'Base',
				receiveToken: 'USDC',
				receiveAmount: '20',
			},
		},
		now: 1,
	});

	store.saveInvoice(invoice);

	assert.equal(fs.existsSync(storePath), true);
	const reloadedStore = await loadTsModule('./lib/chainCashierStore.ts');
	assert.equal(reloadedStore.getInvoice(invoice.invoiceId)?.invoiceId, invoice.invoiceId);

	delete process.env.CHAINCASHIER_STORE_PATH;
});
