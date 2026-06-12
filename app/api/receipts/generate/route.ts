import { NextRequest, NextResponse } from 'next/server';
import { buildSupportPackage, generateReceipt } from '@/lib/chainCashier';
import { getInvoice, updateInvoice } from '@/lib/chainCashierStore';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
		const invoice = getInvoice(invoiceId);

		if (!invoice) {
			return NextResponse.json(
				{ success: false, error: 'Invoice not found' },
				{ status: 404 },
			);
		}

		const receipt =
			invoice.receipt ??
			generateReceipt({
				invoice,
				destinationTxHash: invoice.destinationTxHash,
				lifiStatus: invoice.lifiStatus,
				lifiSubstatus: invoice.lifiSubstatus,
			});
		const updated = updateInvoice(invoice.invoiceId, (current) => ({
			...current,
			status: 'RECEIPT_GENERATED',
			receipt,
		}));

		return NextResponse.json({
			success: true,
			invoice: updated,
			receipt,
			supportPackage: buildSupportPackage({
				invoice: updated ?? { ...invoice, receipt },
			}),
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : 'Failed to generate receipt',
			},
			{ status: 400 },
		);
	}
}

