import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getAgentConfig } from '@/lib/agentConfig';
import { getModelFromConfig } from '@/lib/agentClient';

export const runtime = 'nodejs';

const invoiceSchema = z.object({
	intent: z.literal('CREATE_INVOICE'),
	invoice: z.object({
		receiveChain: z.literal('Base'),
		receiveToken: z.literal('USDC'),
		receiveAmount: z.string(),
		memo: z.string().optional(),
		expiresInMinutes: z.number().optional(),
	}),
	missingFields: z.array(z.string()),
	warnings: z.array(z.string()),
	plan: z.array(z.string()),
});

function fallbackParse(message: string) {
	const amountMatch = message.match(/(\d+(?:\.\d+)?)\s*USDC/i);
	return {
		intent: 'CREATE_INVOICE' as const,
		invoice: {
			receiveChain: 'Base' as const,
			receiveToken: 'USDC' as const,
			receiveAmount: amountMatch?.[1] ?? '20',
			memo: message.replace(/\s+/g, ' ').trim() || 'ChainCashier invoice',
		},
		missingFields: amountMatch ? [] : ['receiveAmount'],
		warnings: amountMatch ? [] : ['Amount was not explicit; demo fallback used 20 USDC.'],
		plan: [
			'Parse merchant receiving goal',
			'Lock merchant address and Base USDC target',
			'Generate invoice and payment link',
			'Require payer wallet confirmation before funds move',
		],
	};
}

export async function POST(request: NextRequest) {
	const body = await request.json();
	const message = typeof body.message === 'string' ? body.message : '';

	if (!message.trim()) {
		return NextResponse.json(
			{ success: false, error: 'message is required' },
			{ status: 400 },
		);
	}

	try {
		const result = await generateObject({
			model: getModelFromConfig(getAgentConfig('checkout')),
			schema: invoiceSchema,
			system: [
				'You are ChainCashier, a GLM-5.1 checkout planning agent.',
				'Parse merchant natural language into a locked Base USDC invoice.',
				'The MVP only supports merchant receiving USDC on Base.',
				'Never claim the agent signs, spends, or custodies funds.',
			].join('\n'),
			prompt: message,
		});

		return NextResponse.json({ success: true, data: result.object });
	} catch (error) {
		return NextResponse.json({
			success: true,
			data: fallbackParse(message),
			warning:
				error instanceof Error
					? `GLM-5.1 unavailable, used deterministic fallback: ${error.message}`
					: 'GLM-5.1 unavailable, used deterministic fallback.',
		});
	}
}

