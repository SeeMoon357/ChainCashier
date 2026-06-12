import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

async function loadEvidenceScriptModule() {
	return import(
		pathToFileURL(
			path.resolve('./scripts/capture-lifi-evidence.mjs'),
		).href
	);
}

test('parseCliArgs reads the required quote capture options', async () => {
	const { parseCliArgs } = await loadEvidenceScriptModule();

	const result = parseCliArgs([
		'--source',
		'8453',
		'--target',
		'137',
		'--amount',
		'0.05',
		'--wallet',
		'0x413716245425e7f9ce59771ba048f1f3dd675dd6',
	]);

	assert.equal(result.sourceChainId, 8453);
	assert.equal(result.targetChainId, 137);
	assert.equal(result.amount, 0.05);
	assert.equal(result.walletAddress, '0x413716245425e7f9ce59771ba048f1f3dd675dd6');
	assert.equal(result.bridge, null);
	assert.equal(result.txHash, null);
});

test('buildEvidenceAssessment classifies refunded status as route_refunded', async () => {
	const { buildEvidenceAssessment } = await loadEvidenceScriptModule();

	const assessment = buildEvidenceAssessment({
		sourceChainId: 8453,
		targetChainId: 137,
		selectedVault: {
			address: '0xvault',
			name: 'BBQUSDC',
			protocolName: 'morpho-v1',
		},
		rawQuote: {
			success: true,
			status: 200,
			body: {
				estimate: {
					approvalAddress: '0xapproval',
				},
				transactionRequest: {
					to: '0xrouter',
					data: '0x1234',
				},
			},
		},
		preview: {
			canExecute: true,
			eligibility: 'ready',
			blockingReason: null,
		},
		statusSummary: {
			clientStatus: 'failed',
			routeStatus: 'refunded',
			substatus: 'REFUNDED',
			message: 'The tokens were refunded to the user.',
			receivingChainId: 8453,
			receivingTokenSymbol: 'USDC',
		},
	});

	assert.equal(assessment.likelyFailureStage, 'route_refunded');
	assert.match(assessment.facts.join('\n'), /8453/);
	assert.match(assessment.inferences.join('\n'), /Base/i);
});
