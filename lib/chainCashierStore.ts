import type { Invoice } from './chainCashier';
import fs from 'node:fs';
import path from 'node:path';

const invoices = new Map<string, Invoice>();

function getStorePath(): string {
	return (
		process.env.CHAINCASHIER_STORE_PATH ??
		'.chaincashier-data/invoices.json'
	);
}

function loadFromDisk() {
	if (invoices.size > 0) {
		return;
	}

	const storePath = getStorePath();
	if (!fs.existsSync(storePath)) {
		return;
	}

	try {
		const raw = fs.readFileSync(storePath, 'utf8');
		const parsed = JSON.parse(raw) as Invoice[];
		for (const invoice of parsed) {
			invoices.set(invoice.invoiceId, invoice);
		}
	} catch {
		// Ignore corrupt local demo state; a new invoice can recreate it.
	}
}

function persistToDisk() {
	const storePath = getStorePath();
	fs.mkdirSync(path.dirname(storePath), { recursive: true });
	fs.writeFileSync(
		storePath,
		JSON.stringify(Array.from(invoices.values()), null, 2),
		'utf8',
	);
}

export function saveInvoice(invoice: Invoice): Invoice {
	loadFromDisk();
	invoices.set(invoice.invoiceId, invoice);
	persistToDisk();
	return invoice;
}

export function getInvoice(invoiceId: string): Invoice | null {
	loadFromDisk();
	return invoices.get(invoiceId) ?? null;
}

export function getLatestInvoice(): Invoice | null {
	loadFromDisk();
	return Array.from(invoices.values()).sort(
		(left, right) => right.createdAt - left.createdAt,
	)[0] ?? null;
}

export function updateInvoice(
	invoiceId: string,
	updater: (invoice: Invoice) => Invoice,
): Invoice | null {
	const current = getInvoice(invoiceId);
	if (!current) {
		return null;
	}

	const updated = updater(current);
	invoices.set(invoiceId, updated);
	persistToDisk();
	return updated;
}
