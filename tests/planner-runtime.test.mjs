import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './helpers/load-ts-module.mjs';

async function loadPlannerRuntimeModule() {
	return loadTsModule('./lib/plannerRuntime.ts');
}

test('resolveWalletChainId falls back to Base for unsupported chains', async () => {
	const { resolveWalletChainId } = await loadPlannerRuntimeModule();

	assert.equal(resolveWalletChainId(8453), 8453);
	assert.equal(resolveWalletChainId(42161), 42161);
	assert.equal(resolveWalletChainId(1), 1);
	assert.equal(resolveWalletChainId(137), 8453);
	assert.equal(resolveWalletChainId(10), 8453);
});

test('detectIntentFromMessage treats vault language as Intents-first', async () => {
	const { detectIntentFromMessage } = await loadPlannerRuntimeModule();

	assert.deepEqual(
		detectIntentFromMessage('put my USDC into the safest vault above 5% APY on Arbitrum'),
		{
			intent: 'intent.transfer',
			actionMode: 'recommend',
		},
	);
});

test('detectIntentFromMessage identifies LI.FI Intents transfer requests', async () => {
	const { detectIntentFromMessage } = await loadPlannerRuntimeModule();

	assert.deepEqual(
		detectIntentFromMessage('move 10 USDC from Base to Arbitrum with best received amount'),
		{
			intent: 'intent.transfer',
			actionMode: 'recommend',
		},
	);
});

test('buildPlannerFallback keeps vault requests on the Intents-first path', async () => {
	const { buildPlannerFallback } = await loadPlannerRuntimeModule();

	const plan = buildPlannerFallback({
		message: 'put 500 USDC into the safest vault above 5% APY on Arbitrum',
		walletChainId: 1,
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.asset, 'USDC');
	assert.equal(plan.amount, 500);
	assert.equal(plan.sourceChain, 1);
	assert.equal(plan.targetChain, 42161);
	assert.equal(plan.minApy, 5);
	assert.equal(plan.riskPreference, 'low');
	assert.equal(plan.mode, 'recommend');
	assert.equal(plan.needsConfirmation, true);
});

test('buildPlannerFallback treats execute/go ahead language as execute mode', async () => {
	const { buildPlannerFallback } = await loadPlannerRuntimeModule();

	const plan = buildPlannerFallback({
		message: 'go ahead and deposit 250 USDC on Base',
		walletChainId: 8453,
	});

	assert.equal(plan.mode, 'execute');
	assert.equal(plan.targetChain, 8453);
});

test('buildPlannerFallback preserves cross-chain source and target chains', async () => {
	const { buildPlannerFallback } = await loadPlannerRuntimeModule();

	const plan = buildPlannerFallback({
		message: 'move 100 USDC from Base into the best USDC vault on Arbitrum',
		walletChainId: 8453,
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 42161);
});

test('buildPlannerFallback builds a Base to Arbitrum Intents transfer plan', async () => {
	const { buildPlannerFallback } = await loadPlannerRuntimeModule();

	const plan = buildPlannerFallback({
		message: 'send 10 USDC from Base to Arbitrum using LI.FI Intents',
		walletChainId: 8453,
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.asset, 'USDC');
	assert.equal(plan.amount, 10);
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 42161);
	assert.equal(plan.objective, 'best_received');
	assert.equal(plan.mode, 'recommend');
});

test('buildPlannerFallback recognizes Polygon as a supported target chain', async () => {
	const { buildPlannerFallback } = await loadPlannerRuntimeModule();

	const plan = buildPlannerFallback({
		message: 'find the best usdc vault on polygon',
		walletChainId: 8453,
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 137);
});

test('buildPlannerFallback keeps Base as source for Base to Polygon requests', async () => {
	const { buildPlannerFallback } = await loadPlannerRuntimeModule();

	const plan = buildPlannerFallback({
		message: 'move 10 usdc from base into the best usdc vault on polygon',
		walletChainId: 8453,
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 137);
});

test('extractPlannerPayload accepts valid JSON planner output and normalizes chains', async () => {
	const { extractPlannerPayload } = await loadPlannerRuntimeModule();

	const plan = extractPlannerPayload(
		'{"intent":"earn.deposit","asset":"USDC","amount":500,"sourceChain":10,"targetChain":42161,"minApy":5,"riskPreference":"low","needsConfirmation":true,"mode":"execute"}',
		8453,
	);

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 42161);
	assert.equal(plan.mode, 'execute');
});

test('extractPlannerPayload treats zero or negative amounts as missing', async () => {
	const { extractPlannerPayload } = await loadPlannerRuntimeModule();

	const zeroAmountPlan = extractPlannerPayload(
		'{"intent":"earn.deposit","asset":"USDC","amount":0,"sourceChain":8453,"targetChain":8453,"minApy":5,"riskPreference":"medium","needsConfirmation":true,"mode":"recommend"}',
		8453,
	);
	const negativeAmountPlan = extractPlannerPayload(
		'{"intent":"earn.deposit","asset":"USDC","amount":-10,"sourceChain":8453,"targetChain":8453,"minApy":5,"riskPreference":"medium","needsConfirmation":true,"mode":"recommend"}',
		8453,
	);

	assert.equal(zeroAmountPlan.amount, null);
	assert.equal(negativeAmountPlan.amount, null);
});

test('mergeIntentPlanFromUserText lets deterministic user text override bad planner fields', async () => {
	const { mergeIntentPlanFromUserText } = await loadPlannerRuntimeModule();

	const plan = mergeIntentPlanFromUserText({
		userMessage: 'Move 0.01 USDC from Base to Arbitrum with best received amount',
		walletChainId: 8453,
		plannerPlan: {
			intent: 'intent.transfer',
			asset: 'USDC',
			amount: null,
			sourceChain: 8453,
			targetChain: 8453,
			minApy: null,
			riskPreference: 'medium',
			objective: 'best_received',
			needsConfirmation: true,
			mode: 'recommend',
		},
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.amount, 0.01);
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 42161);
	assert.equal(plan.objective, 'best_received');
});

test('mergeIntentPlanFromUserText handles compact USDC amount spelling', async () => {
	const { mergeIntentPlanFromUserText } = await loadPlannerRuntimeModule();

	const plan = mergeIntentPlanFromUserText({
		userMessage: 'Move 0.01USDC from Base to Arbitrum',
		walletChainId: 8453,
		plannerPlan: {
			intent: 'intent.transfer',
			asset: 'USDC',
			amount: null,
			sourceChain: 8453,
			targetChain: 8453,
			minApy: null,
			riskPreference: 'medium',
			objective: 'best_received',
			needsConfirmation: true,
			mode: 'recommend',
		},
	});

	assert.equal(plan.intent, 'intent.transfer');
	assert.equal(plan.amount, 0.01);
	assert.equal(plan.sourceChain, 8453);
	assert.equal(plan.targetChain, 42161);
});
