import { NextRequest, NextResponse } from 'next/server';
import { normalizeAgentRequest } from '@/lib/agentRuntime';
import { mainAgentStream } from './agents/main';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const normalizedRequest = normalizeAgentRequest(body);

		if (!normalizedRequest.ok) {
			return NextResponse.json(
				{
					success: false,
					error: normalizedRequest.error,
				},
				{ status: 400 },
			);
		}

		const { message, userAddress, walletChainId, mode, messages } =
			normalizedRequest.value;
		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			start: async (controller) => {
				const send = (payload: unknown) => {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
					);
				};

				try {
					for await (const chunk of mainAgentStream({
						userMessage: message,
						userAddress,
						walletChainId,
						mode,
						messages,
					})) {
						send(chunk);
					}
				} catch (error) {
					send({
						type: 'error',
						content:
							error instanceof Error ? error.message : 'Unknown agent error',
					});
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

export async function GET() {
	return NextResponse.json({
		status: 'ok',
		message: 'Agent API is running',
		supportedIntents: ['earn'],
		version: '2.0.0',
	});
}
