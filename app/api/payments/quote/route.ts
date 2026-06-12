import { NextRequest, NextResponse } from 'next/server';
import {
	buildPaymentQuoteRequest,
	summarizePaymentQuote,
} from '@/lib/chainCashier';
import { getInvoice, saveInvoice, updateInvoice } from '@/lib/chainCashierStore';
import { createLifiClient } from '@/lib/lifiClient';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
		const invoice = getInvoice(invoiceId) ?? body.invoice ?? null;

		if (!invoice) {
			return NextResponse.json(
				{ success: false, error: 'Invoice not found' },
				{ status: 404 },
			);
		}
		saveInvoice(invoice);

		const quoteRequest = buildPaymentQuoteRequest({
			invoice,
			payerAddress: body.payerAddress,
			sourceChainId: Number(body.sourceChainId),
			sourceTokenAddress: body.sourceTokenAddress,
		});
		const quoteResult = await createLifiClient().getQuoteToAmount(quoteRequest);

		if (!quoteResult.success) {
			return NextResponse.json(
				{ success: false, error: quoteResult.error, payload: quoteResult.payload },
				{ status: 502 },
			);
		}

		const quote = summarizePaymentQuote({
			invoice,
			sourceChainId: quoteRequest.fromChain,
			sourceTokenAddress: quoteRequest.fromToken,
			rawQuote: quoteResult.data,
		});
		const updated = updateInvoice(invoice.invoiceId, (current) => ({
			...current,
			status: 'QUOTE_READY',
			payerAddress: quoteRequest.fromAddress,
			sourceChainId: quoteRequest.fromChain,
			sourceChain:
				quoteRequest.fromChain === 42161
					? 'Arbitrum'
					: quoteRequest.fromChain === 10
						? 'Optimism'
						: quoteRequest.fromChain === 137
							? 'Polygon'
							: `Chain ${quoteRequest.fromChain}`,
			sourceToken: 'USDC',
			sourceTokenAddress: quoteRequest.fromToken,
			quote,
		}));

		return NextResponse.json({
			success: true,
			invoice: updated,
			quote,
			rawQuote: quoteResult.data,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to build quote',
			},
			{ status: 400 },
		);
	}
}
