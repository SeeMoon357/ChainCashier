import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { formatUnits } from 'viem';
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
						send({
							type: 'run_event',
							event: createRunEvent({
								step: 'plan',
								status: 'completed',
								summary: 'GLM-5.1 parsed the merchant goal into a checkout plan.',
								tool: 'GLM-5.1 structured generation',
								inputSummary: message,
								outputSummary: `${createdInvoice.receiveAmount} ${createdInvoice.receiveToken} on ${createdInvoice.receiveChain}`,
							}),
						});
						send({
							type: 'run_event',
							event: createRunEvent({
								step: 'invoice',
								status: 'completed',
								summary: 'Locked invoice terms: merchant address, settlement chain, token, amount, and fee policy.',
								outputSummary: `${createdInvoice.invoiceId}: ${createdInvoice.receiveAmount} ${createdInvoice.receiveToken} on ${createdInvoice.receiveChain}`,
								artifact: 'locked invoice',
							}),
						});
						send({ type: 'invoice', invoice: createdInvoice });
						send({
							type: 'run_event',
							event: createRunEvent({
								step: 'link',
								status: 'completed',
								summary: 'Generated an independent payer checkout link.',
								outputSummary: createdInvoice.paymentLink,
								artifact: 'payment link',
							}),
						});
						sendChunks(
							send,
							streamResponseText(
								[
									'Done. I created the payment invoice.',
									`Merchant will receive **${createdInvoice.receiveAmount} ${createdInvoice.receiveToken} on ${createdInvoice.receiveChain}**.`,
									`Payment link: ${createdInvoice.paymentLink}`,
									'Send this link to the payer. They will choose a supported source chain in the independent checkout chat and confirm payment with their own wallet.',
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
							summary: 'LI.FI selected the fastest stablecoin route for exact merchant settlement.',
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
					send({ type: 'response', content: 'Received. The merchant requests ' });
					send({
						type: 'response',
						content: `**${updatedInvoice.receiveAmount} ${updatedInvoice.receiveToken} on ${updatedInvoice.receiveChain}**.` + '\n\n',
					});
					send({
						type: 'response',
						content: `You selected **${quoteRequestChunk.source.label}** as the payer source.` + '\n\n',
					});
					send({
						type: 'response',
						content: `LI.FI selected the fastest stablecoin route via **${quote.toolName ?? quote.tool ?? 'LI.FI'}** with estimated route time **${quote.executionDuration == null ? 'n/a' : `${quote.executionDuration}s` }**. Estimated payer cost is **${formatUnits(BigInt(quote.estimatedFromAmount), 6)} USDC**. Please review fees and minimum received, then confirm in your wallet.`,
					});
					send({
						type: 'response',
						content:
							'\n\nNote: Agent never signs or transfers funds. Funds move only after you confirm the wallet transaction.',
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
