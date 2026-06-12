import { NextRequest, NextResponse } from 'next/server';
import { getInvoice, updateInvoice } from '@/lib/chainCashierStore';
import type { Invoice } from '@/lib/chainCashier';

export const runtime = 'nodejs';

type RouteContext = {
	params: Promise<{ invoiceId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
	const { invoiceId } = await context.params;
	const invoice = getInvoice(invoiceId);

	if (!invoice) {
		return NextResponse.json(
			{ success: false, error: 'Invoice not found' },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true, invoice });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
	const { invoiceId } = await context.params;
	const body = (await request.json()) as Partial<Invoice>;
	const invoice = updateInvoice(invoiceId, (current) => ({
		...current,
		...body,
		invoiceId: current.invoiceId,
		merchantAddress: current.merchantAddress,
		receiveChain: current.receiveChain,
		receiveChainId: current.receiveChainId,
		receiveToken: current.receiveToken,
		receiveTokenAddress: current.receiveTokenAddress,
		receiveAmount: current.receiveAmount,
		feePolicy: current.feePolicy,
		paymentLink: current.paymentLink,
		createdAt: current.createdAt,
	}));

	if (!invoice) {
		return NextResponse.json(
			{ success: false, error: 'Invoice not found' },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true, invoice });
}

