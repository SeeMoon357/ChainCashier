import { NextRequest, NextResponse } from 'next/server';
import { updateInvoice } from '@/lib/chainCashierStore';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	const body = await request.json();
	const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
	const sourceTxHash =
		typeof body.sourceTxHash === 'string' ? body.sourceTxHash : '';
	const payerAddress =
		typeof body.payerAddress === 'string' ? body.payerAddress : undefined;

	if (!sourceTxHash.startsWith('0x')) {
		return NextResponse.json(
			{ success: false, error: 'sourceTxHash is required' },
			{ status: 400 },
		);
	}

	const invoice = updateInvoice(invoiceId, (current) => ({
		...current,
		status: 'PAYMENT_SUBMITTED',
		sourceTxHash: sourceTxHash as `0x${string}`,
		payerAddress: (payerAddress ?? current.payerAddress) as `0x${string}`,
	}));

	if (!invoice) {
		return NextResponse.json(
			{ success: false, error: 'Invoice not found' },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true, invoice });
}

