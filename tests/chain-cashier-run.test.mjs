import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from './helpers/load-ts-module.mjs';

test('buildAgentRunLog summarizes plan, tool calls, validation, repair, and artifacts', async () => {
	const { createRunEvent, buildAgentRunLog } = await loadTsModule(
		'./lib/chainCashierRun.ts',
	);

	const events = [
		createRunEvent({
			step: 'plan',
			status: 'completed',
			summary: 'GLM-5.1 parsed merchant goal and planned checkout.',
			tool: 'GLM-5.1 structured generation',
			outputSummary: 'receiveChain=Base, amount=20 USDC',
		}),
		createRunEvent({
			step: 'quote',
			status: 'completed',
			summary: 'Requested exact-toAmount route.',
			tool: 'LI.FI quote/toAmount',
			inputSummary: 'Arbitrum USDC -> Base USDC',
			outputSummary: 'Route returned 20 USDC target amount.',
		}),
		createRunEvent({
			step: 'validate',
			status: 'completed',
			summary: 'Quote target matched locked invoice.',
			validation: ['target address matched', 'target chain matched', 'target token matched'],
		}),
		createRunEvent({
			step: 'repair',
			status: 'action_required',
			summary: 'Arbitrum quote failed; user must approve trying alternatives.',
			repairAction: 'Ask payer whether to try Optimism or Polygon.',
		}),
		createRunEvent({
			step: 'receipt',
			status: 'completed',
			summary: 'Receipt and support package generated.',
			artifact: 'receipt/support package',
		}),
	];

	const log = buildAgentRunLog({
		runId: 'run-test',
		userGoal: 'Receive 20 USDC on Base',
		events,
	});

	assert.equal(log.runId, 'run-test');
	assert.equal(log.userGoal, 'Receive 20 USDC on Base');
	assert.deepEqual(log.plan, ['GLM-5.1 parsed merchant goal and planned checkout.']);
	assert.deepEqual(log.toolCalls, ['GLM-5.1 structured generation', 'LI.FI quote/toAmount']);
	assert.match(log.validation.join('\n'), /target address matched/);
	assert.deepEqual(log.repairActions, ['Ask payer whether to try Optimism or Polygon.']);
	assert.deepEqual(log.finalArtifacts, ['receipt/support package']);
	assert.match(log.safetyBoundary, /Agent never signs/);
});
