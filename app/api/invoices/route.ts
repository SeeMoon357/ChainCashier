import { NextRequest, NextResponse } from 'next/server';
import { createInvoiceFromAgentOutput } from '@/lib/chainCashier';
import { getLatestInvoice, saveInvoice } from '@/lib/chainCashierStore';

export const runtime = 'nodejs';

function getOrigin(request: NextRequest): string {
	return request.headers.get('origin') ?? request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const merchantAddress =
			typeof body.merchantAddress === 'string' ? body.merchantAddress : '';
		const invoice = createInvoiceFromAgentOutput({
			merchantAddress,
			origin: getOrigin(request),
			agentOutput: body.agentOutput ?? body,
		});

		return NextResponse.json({ success: true, invoice: saveInvoice(invoice) });
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create invoice',
			},
			{ status: 400 },
		);
	}
}

export async function GET() {
	return NextResponse.json({ success: true, invoice: getLatestInvoice() });
}

