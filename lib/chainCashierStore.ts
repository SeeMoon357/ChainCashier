import type { Invoice } from './chainCashier';

const invoices = new Map<string, Invoice>();

export function saveInvoice(invoice: Invoice): Invoice {
	invoices.set(invoice.invoiceId, invoice);
	return invoice;
}

export function getInvoice(invoiceId: string): Invoice | null {
	return invoices.get(invoiceId) ?? null;
}

export function getLatestInvoice(): Invoice | null {
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
	return updated;
}

