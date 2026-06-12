import { NextRequest, NextResponse } from 'next/server';
import { resolveInvoiceStatusFromLifiStatus } from '@/lib/chainCashier';
import { getInvoice, updateInvoice } from '@/lib/chainCashierStore';
import { createLifiClient } from '@/lib/lifiClient';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
	const invoiceId = request.nextUrl.searchParams.get('invoiceId') ?? '';
	const invoice = getInvoice(invoiceId);

	if (!invoice) {
		return NextResponse.json(
			{ success: false, error: 'Invoice not found' },
			{ status: 404 },
		);
	}

	if (!invoice.sourceTxHash || !invoice.sourceChainId) {
		return NextResponse.json({ success: true, invoice });
	}

	const statusResult = await createLifiClient().getStatus({
		txHash: invoice.sourceTxHash,
		fromChain: invoice.sourceChainId,
		toChain: invoice.receiveChainId,
	});

	if (!statusResult.success) {
		return NextResponse.json(
			{ success: false, error: statusResult.error, payload: statusResult.payload },
			{ status: 502 },
		);
	}

	const updated = resolveInvoiceStatusFromLifiStatus({
		invoice,
		lifiStatus: statusResult.data,
	});
	updateInvoice(invoice.invoiceId, () => updated);

	return NextResponse.json({
		success: true,
		invoice: updated,
		lifiStatus: statusResult.data,
	});
}

