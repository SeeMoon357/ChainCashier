import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
	buildMerchantChatCreatedInvoice,
	buildMerchantGeneralResponse,
	buildMerchantMissingAmountResponse,
	buildPayerQuotePlan,
	resolveMerchantRequest,
	type ChainCashierChatChunk,
} from '@/lib/chainCashierChat';
import {
	createInvoiceFromAgentOutput,
	summarizePaymentQuote,
	type Invoice,
} from '@/lib/chainCashier';
import { createRunEvent } from '@/lib/chainCashierRun';
import { getAgentConfig } from '@/lib/agentConfig';
import { getModelFromConfig } from '@/lib/agentClient';
import { createLifiClient } from '@/lib/lifiClient';
import { saveInvoice, updateInvoice } from '@/lib/chainCashierStore';

export const runtime = 'nodejs';

const merchantInvoiceSchema = z.object({
	invoice: z.object({
		receiveChain: z.enum(['Base', 'Arbitrum']),
		receiveToken: z.literal('USDC'),
		receiveAmount: z.string(),
		memo: z.string().optional(),
		expiresInMinutes: z.number().optional(),
	}),
});

function getOrigin(request: NextRequest): string {
	return request.headers.get('origin') ?? request.nextUrl.origin;
}

function streamResponseText(text: string): ChainCashierChatChunk[] {
	const chunks: ChainCashierChatChunk[] = [];
	for (const paragraph of text.split('\n')) {
		chunks.push({ type: 'response', content: `${paragraph}\n` });
	}
	return chunks;
}

function sendChunks(
	send: (payload: ChainCashierChatChunk) => void,
	chunks: ChainCashierChatChunk[],
) {
	for (const chunk of chunks) {
		send(chunk);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const role = body.role === 'payer' ? 'payer' : 'merchant';
		const message = typeof body.message === 'string' ? body.message : '';
		const address = typeof body.address === 'string' ? body.address : '';
		const invoice = body.invoice as Invoice | null;
		const encoder = new TextEncoder();

		if (!message.trim()) {
			return NextResponse.json(
				{ success: false, error: 'message is required' },
				{ status: 400 },
			);
		}

		const stream = new ReadableStream({
			start: async (controller) => {
				const send = (payload: ChainCashierChatChunk) => {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
					);
				};

				try {
					if (role === 'merchant') {
						const merchantRequest = resolveMerchantRequest(message);
						if (merchantRequest.kind === 'general') {
							sendChunks(send, buildMerchantGeneralResponse());
							return;
						}
						if (merchantRequest.kind === 'invoice_missing_amount') {
							sendChunks(send, buildMerchantMissingAmountResponse());
							return;
						}
						if (!address) {
							send({ type: 'error', content: 'Connect a merchant wallet first.' });
							send({ type: 'done' });
							return;
						}

						send({
							type: 'thinking',
							content: 'Parsing merchant invoice goal with GLM-5.1...\n',
						});
						send({
							type: 'thinking',
							content:
								'Checking supported scope: Base or Arbitrum USDC, payer covers cross-chain cost...\n',
						});

						let createdInvoice: Invoice | null = null;
						try {
							const parsed = await generateObject({
								model: getModelFromConfig(getAgentConfig('checkout')),
								schema: merchantInvoiceSchema,
								system: [
									'You are ChainCashier, a checkout planning agent.',
									'Extract a USDC invoice from the merchant request.',
									'Supported merchant receiving chains are Base and Arbitrum.',
									'Default receiveChain to Base unless the merchant explicitly asks to receive on Arbitrum or Arb.',
									'Only return an invoice when the merchant explicitly asks to create a payment request.',
								].join('\n'),
								prompt: message,
							});
							createdInvoice = createInvoiceFromAgentOutput({
								merchantAddress: address,
								origin: getOrigin(request),
								agentOutput: parsed.object,
							});
						} catch {
							const fallbackChunks = buildMerchantChatCreatedInvoice({
								message,
								merchantAddress: address,
								origin: getOrigin(request),
							});
							createdInvoice =
								fallbackChunks.find((chunk) => chunk.type === 'invoice')?.invoice ??
								null;
						}

						if (!createdInvoice) {
							sendChunks(send, buildMerchantMissingAmountResponse());
							return;
						}

						saveInvoice(createdInvoice);
						send({ type: 'invoice', invoice: createdInvoice });
						sendChunks(
							send,
							streamResponseText(
								[
									'好的，我已经生成收款账单。',
									`商户将收到 **${createdInvoice.receiveAmount} ${createdInvoice.receiveToken} on ${createdInvoice.receiveChain}**。`,
									`付款链接：${createdInvoice.paymentLink}`,
									'你可以把这个链接发给付款人。付款人会在独立聊天页面里选择来源链，并用自己的钱包确认支付。',
								].join('\n\n'),
							),
						);
						send({ type: 'done' });
						return;
					}

					if (!invoice) {
						send({ type: 'error', content: 'Invoice is missing from checkout page.' });
						send({ type: 'done' });
						return;
					}
					if (!address) {
						send({ type: 'error', content: 'Connect a payer wallet first.' });
						send({ type: 'done' });
						return;
					}

					const planChunks = buildPayerQuotePlan({
						message,
						invoice,
						payerAddress: address,
					});
					sendChunks(send, planChunks);

					const quoteRequestChunk = planChunks.find(
						(chunk) => chunk.type === 'quote_request',
					);
					if (!quoteRequestChunk || quoteRequestChunk.type !== 'quote_request') {
						send({ type: 'done' });
						return;
					}

					send({
						type: 'thinking',
						content:
							'Requesting LI.FI quote/toAmount for exact merchant settlement...\n',
					});
					const quoteResult = await createLifiClient().getQuoteToAmount(
						quoteRequestChunk.request,
					);
					if (!quoteResult.success) {
						send({
							type: 'run_event',
							event: createRunEvent({
								step: 'repair',
								status: 'action_required',
								summary: 'LI.FI quote request failed before wallet execution.',
								tool: 'LI.FI quote/toAmount',
								inputSummary: `${quoteRequestChunk.source.label} -> ${invoice.receiveChain} ${invoice.receiveToken}`,
								outputSummary: quoteResult.error,
								repairAction:
									'Ask payer to retry later or choose another supported source chain when available.',
							}),
						});
						send({ type: 'error', content: quoteResult.error });
						send({ type: 'done' });
						return;
					}

					const quote = summarizePaymentQuote({
						invoice,
						sourceChainId: quoteRequestChunk.source.chainId,
						sourceTokenAddress: quoteRequestChunk.source.tokenAddress,
						rawQuote: quoteResult.data,
					});
					send({
						type: 'run_event',
						event: createRunEvent({
							step: 'quote',
							status: 'completed',
							summary: 'LI.FI returned an exact-toAmount quote.',
							tool: 'LI.FI quote/toAmount',
							outputSummary: quote.routeSummary,
						}),
					});
					send({
						type: 'run_event',
						event: createRunEvent({
							step: 'validate',
							status: 'completed',
							summary: 'Quote passed locked invoice safety checks.',
							validation: [
								'target address matched merchant address',
								`target chain matched ${invoice.receiveChain}`,
								`target token matched ${invoice.receiveToken}`,
							],
						}),
					});
					const updatedInvoice = {
						...invoice,
						status: 'QUOTE_READY' as const,
						payerAddress: address as `0x${string}`,
						sourceChain: quoteRequestChunk.source.label.replace(' USDC', ''),
						sourceChainId: quoteRequestChunk.source.chainId,
						sourceToken: 'USDC',
						sourceTokenAddress: quoteRequestChunk.source.tokenAddress,
						quote,
					};
					const persistedInvoice = updateInvoice(
						invoice.invoiceId,
						() => updatedInvoice,
					);
					if (!persistedInvoice) {
						saveInvoice(updatedInvoice);
					}
					send({ type: 'invoice', invoice: updatedInvoice });
					send({
						type: 'quote_request',
						source: quoteRequestChunk.source,
						request: quoteRequestChunk.request,
					});
					send({ type: 'quote', quote, rawQuote: quoteResult.data });
					send({ type: 'response', content: '收到。商户要求收到 ' });
					send({
						type: 'response',
						content: `**${invoice.receiveAmount} ${invoice.receiveToken} on ${invoice.receiveChain}**。\n\n`,
					});
					send({
						type: 'response',
						content: `你选择从 **${quoteRequestChunk.source.label}** 支付。\n\n`,
					});
					send({
						type: 'response',
						content: `LI.FI 已返回报价：预计你需要支付 **${quote.estimatedFromAmount}** 个 USDC base units。请检查费用和最小到账，然后用钱包确认。`,
					});
					send({
						type: 'response',
						content:
							'\n\n注意：Agent 不会签名或转账，资金只会在你确认钱包交易后移动。',
					});
					send({ type: 'done' });
				} catch (error) {
					send({
						type: 'error',
						content: error instanceof Error ? error.message : 'Unknown chat error',
					});
					send({ type: 'done' });
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream; charset=utf-8',
				'Cache-Control': 'no-cache, no-transform',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no',
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
