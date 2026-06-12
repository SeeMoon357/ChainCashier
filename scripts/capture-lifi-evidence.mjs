import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

function parseNumberFlag(value, flagName) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Flag ${flagName} requires a numeric value.`);
	}

	return parsed;
}

export function parseCliArgs(argv) {
	const args = {
		sourceChainId: null,
		targetChainId: null,
		amount: null,
		walletAddress: null,
		targetVaultAddress: null,
		txHash: null,
		transactionId: null,
		bridge: null,
		outputPath: null,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		const value = argv[index + 1];

		switch (flag) {
			case '--source':
				args.sourceChainId = parseNumberFlag(value, flag);
				index += 1;
				break;
			case '--target':
				args.targetChainId = parseNumberFlag(value, flag);
				index += 1;
				break;
			case '--amount':
				args.amount = parseNumberFlag(value, flag);
				index += 1;
				break;
			case '--wallet':
				args.walletAddress = value ?? null;
				index += 1;
				break;
			case '--vault':
				args.targetVaultAddress = value ?? null;
				index += 1;
				break;
			case '--txHash':
				args.txHash = value ?? null;
				index += 1;
				break;
			case '--transactionId':
				args.transactionId = value ?? null;
				index += 1;
				break;
			case '--bridge':
				args.bridge = value ?? null;
				index += 1;
				break;
			case '--output':
				args.outputPath = value ?? null;
				index += 1;
				break;
			default:
				throw new Error(`Unknown flag: ${flag}`);
		}
	}

	if (!args.sourceChainId || !args.targetChainId || args.amount == null || !args.walletAddress) {
		throw new Error(
			'Usage: node scripts/capture-lifi-evidence.mjs --source <chainId> --target <chainId> --amount <usdc> --wallet <address> [--vault <address>] [--txHash <hash>] [--transactionId <id>] [--bridge <name>] [--output <path>]',
		);
	}

	return args;
}

function normalizeSlashes(value) {
	return value.replace(/\\/g, '/');
}

function resolveSourceFile(basePath) {
	const candidates = [
		basePath,
		`${basePath}.ts`,
		`${basePath}.tsx`,
		path.join(basePath, 'index.ts'),
		path.join(basePath, 'index.tsx'),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

function resolveLocalImport(projectRoot, fromFile, specifier) {
	if (specifier.startsWith('@/')) {
		return resolveSourceFile(path.resolve(projectRoot, specifier.slice(2)));
	}

	if (specifier.startsWith('.')) {
		return resolveSourceFile(path.resolve(path.dirname(fromFile), specifier));
	}

	return null;
}

async function loadTsModule(entryRelativePath) {
	const projectRoot = path.resolve('.');
	const entryPath = path.resolve(entryRelativePath);
	const cacheRoot = path.join(projectRoot, 'node_modules', '.cache');
	fs.mkdirSync(cacheRoot, { recursive: true });
	const tempRoot = fs.mkdtempSync(path.join(cacheRoot, 'codex-lifi-evidence-'));
	const visited = new Map();

	function replaceSpecifier(source, originalSpecifier, replacementSpecifier) {
		return source
			.split(`'${originalSpecifier}'`)
			.join(`'${replacementSpecifier}'`)
			.split(`"${originalSpecifier}"`)
			.join(`"${replacementSpecifier}"`);
	}

	function toOutputPath(sourcePath) {
		const relativePath = path.relative(projectRoot, sourcePath);
		return path.join(tempRoot, relativePath.replace(/\.(ts|tsx)$/, '.mjs'));
	}

	function compileFile(sourcePath) {
		if (visited.has(sourcePath)) {
			return visited.get(sourcePath);
		}

		const source = fs.readFileSync(sourcePath, 'utf8');
		const outputPath = toOutputPath(sourcePath);
		visited.set(sourcePath, outputPath);

		const importSpecifiers = ts.preProcessFile(source).importedFiles.map(
			(file) => file.fileName,
		);

		let transpiled = ts.transpileModule(source, {
			compilerOptions: {
				module: ts.ModuleKind.ES2022,
				target: ts.ScriptTarget.ES2022,
				jsx: ts.JsxEmit.ReactJSX,
			},
			fileName: sourcePath,
		}).outputText;

		for (const specifier of importSpecifiers) {
			const resolved = resolveLocalImport(projectRoot, sourcePath, specifier);
			if (!resolved) {
				continue;
			}

			const dependencyOutputPath = compileFile(resolved);
			const relativeSpecifier = normalizeSlashes(
				path.relative(path.dirname(outputPath), dependencyOutputPath),
			);
			const finalSpecifier = relativeSpecifier.startsWith('.')
				? relativeSpecifier
				: `./${relativeSpecifier}`;
			transpiled = replaceSpecifier(transpiled, specifier, finalSpecifier);
		}

		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, transpiled, 'utf8');
		return outputPath;
	}

	const compiledEntry = compileFile(entryPath);
	return import(pathToFileURL(compiledEntry).href);
}

function sanitizeQuoteBody(body) {
	if (!body || typeof body !== 'object') {
		return body;
	}

	return body;
}

function createCapturingFetch() {
	const captures = [];

	async function capturingFetch(url, init) {
		const response = await fetch(url, init);
		const responseClone = response.clone();
		let body;

		try {
			body = await responseClone.json();
		} catch {
			body = await responseClone.text();
		}

		captures.push({
			url: String(url),
			method: init?.method ?? 'GET',
			status: response.status,
			ok: response.ok,
			body,
		});

		return response;
	}

	return {
		capturingFetch,
		captures,
	};
}

function quoteFailureReason(rawQuote) {
	if (!rawQuote?.ok) {
		return typeof rawQuote?.body === 'string'
			? rawQuote.body
			: `LI.FI request failed with status ${rawQuote?.status ?? 'unknown'}.`;
	}

	const body = rawQuote.body;
	if (!body?.estimate?.approvalAddress) {
		return 'LI.FI quote is missing the approval target required for ERC20 execution.';
	}

	if (!body?.transactionRequest?.to || !body?.transactionRequest?.data) {
		return 'LI.FI quote did not return executable transaction data for this vault.';
	}

	return null;
}

export function buildEvidenceAssessment(input) {
	const facts = [];
	const inferences = [];
	let likelyFailureStage = 'preview_ready';

	facts.push(
		`Source ${input.sourceChainId} -> target ${input.targetChainId} using vault ${input.selectedVault.address}.`,
	);

	if (!input.rawQuote.success) {
		likelyFailureStage = 'quote_request_failed';
		facts.push(`LI.FI quote request returned status ${input.rawQuote.status}.`);
		if (input.preview.blockingReason) {
			facts.push(`Preview blocking reason: ${input.preview.blockingReason}`);
		}
		return { likelyFailureStage, facts, inferences };
	}

	if (!input.preview.canExecute) {
		likelyFailureStage = 'quote_unexecutable';
		facts.push(
			`LI.FI quote returned status ${input.rawQuote.status} but the app marked it non-executable.`,
		);
		if (input.preview.blockingReason) {
			facts.push(`Preview blocking reason: ${input.preview.blockingReason}`);
		}
	}

	if (input.statusSummary?.routeStatus === 'refunded') {
		likelyFailureStage = 'route_refunded';
		facts.push(
			`Status API reports REFUNDED with receiving chain ${input.statusSummary.receivingChainId}.`,
		);
		inferences.push(
			`Route execution did not finish on the destination chain and refunded back to ${input.statusSummary.receivingTokenSymbol ?? 'the receiving asset'} on ${
				input.statusSummary.receivingChainId === 8453 ? 'Base' : `chain ${input.statusSummary.receivingChainId}`
			}.`,
		);
	}

	return { likelyFailureStage, facts, inferences };
}

async function main() {
	const args = parseCliArgs(process.argv.slice(2));
	const [
		lifiDomainModule,
		lifiClientModule,
		executionRuntimeModule,
		lifiRuntimeModule,
		lifiStatusModule,
		businessChainsModule,
	] = await Promise.all([
		loadTsModule('./lib/lifiDomain.ts'),
		loadTsModule('./lib/lifiClient.ts'),
		loadTsModule('./lib/executionRuntime.ts'),
		loadTsModule('./lib/lifiRuntime.ts'),
		loadTsModule('./lib/lifiStatus.ts'),
		loadTsModule('./lib/businessChains.ts'),
	]);

	const {
		searchVaults,
		selectRecommendedVault,
	} = lifiDomainModule;
	const { createLifiClient } = lifiClientModule;
	const { buildExecutionPreview } = executionRuntimeModule;
	const { buildVaultDisplayName } = lifiRuntimeModule;
	const { resolveLifiRouteStatus } = lifiStatusModule;
	const { getUsdcAddress, getChainLabel } = businessChainsModule;

	const vaultSearch = await searchVaults({
		chainId: args.targetChainId,
		limit: 10,
	});

	if (!vaultSearch.success) {
		throw new Error(`Vault search failed: ${vaultSearch.error}`);
	}

	const rankedVaults = selectRecommendedVault({
		vaults: vaultSearch.vaults.filter((vault) => vault.underlyingSymbol === 'USDC'),
		minApy: null,
		riskPreference: 'medium',
	});

	const selectedVault =
		args.targetVaultAddress != null
			? vaultSearch.vaults.find((vault) => vault.address.toLowerCase() === args.targetVaultAddress.toLowerCase()) ?? {
					address: args.targetVaultAddress,
					chainId: args.targetChainId,
					name: 'Provided vault',
					protocolName: 'unknown',
					underlyingSymbol: 'USDC',
					underlyingTokenAddress: '',
					apyTotal: 0,
					tvlUsd: 0,
					tags: [],
					isTransactional: true,
					isRedeemable: false,
					dataSource: 'fallback',
			  }
			: rankedVaults.selectedVault;

	if (!selectedVault) {
		throw new Error('No target vault could be selected for this run.');
	}

	const fromToken = getUsdcAddress(args.sourceChainId);
	if (!fromToken) {
		throw new Error(`No USDC address configured for chain ${args.sourceChainId}.`);
	}

	const { capturingFetch, captures } = createCapturingFetch();
	const client = createLifiClient(capturingFetch);
	const fromAmount = (BigInt(Math.round(args.amount * 1_000_000))).toString();

	const quoteResult = await client.getQuote({
		fromChain: args.sourceChainId,
		toChain: args.targetChainId,
		fromToken,
		toToken: selectedVault.address,
		fromAmount,
		fromAddress: args.walletAddress,
		toAddress: args.walletAddress,
	});

	const rawQuoteCapture = captures[captures.length - 1] ?? null;
	const preview = buildExecutionPreview({
		plan: {
			intent: 'earn.deposit',
			asset: 'USDC',
			amount: args.amount,
			sourceChain: args.sourceChainId,
			targetChain: args.targetChainId,
			minApy: null,
			riskPreference: 'medium',
			needsConfirmation: true,
			mode: 'execute',
		},
		selectedVault: {
			address: selectedVault.address,
			name: selectedVault.name,
			displayName: buildVaultDisplayName(selectedVault),
			dataSource: selectedVault.dataSource,
		},
		quote: quoteResult.success ? sanitizeQuoteBody(quoteResult.data) : null,
		quoteFailureReason: quoteFailureReason(
			rawQuoteCapture
				? {
						ok: rawQuoteCapture.ok,
						status: rawQuoteCapture.status,
						body: rawQuoteCapture.body,
				  }
				: null,
		),
	});

	let statusCapture = null;
	let statusSummary = null;

	if (args.txHash) {
		const statusResult = await client.getStatus({
			txHash: args.txHash,
			fromChain: args.sourceChainId,
			toChain: args.targetChainId,
			...(args.bridge ? { bridge: args.bridge } : {}),
			...(args.transactionId ? { transactionId: args.transactionId } : {}),
		});
		statusCapture = captures[captures.length - 1] ?? null;
		if (statusResult.success) {
			statusSummary = resolveLifiRouteStatus(statusResult.data);
		}
	}

	const assessment = buildEvidenceAssessment({
		sourceChainId: args.sourceChainId,
		targetChainId: args.targetChainId,
		selectedVault: {
			address: selectedVault.address,
			name: selectedVault.name,
			protocolName: selectedVault.protocolName,
		},
		rawQuote: rawQuoteCapture
			? {
					success: rawQuoteCapture.ok,
					status: rawQuoteCapture.status,
					body: rawQuoteCapture.body,
			  }
			: {
					success: false,
					status: null,
					body: null,
			  },
		preview: {
			canExecute: preview.canExecute,
			eligibility: preview.eligibility,
			blockingReason: preview.blockingReason,
		},
		statusSummary,
	});

	const report = {
		parameters: {
			sourceChainId: args.sourceChainId,
			targetChainId: args.targetChainId,
			sourceChainLabel: getChainLabel(args.sourceChainId),
			targetChainLabel: getChainLabel(args.targetChainId),
			amount: args.amount,
			walletAddress: args.walletAddress,
			targetVaultAddress: selectedVault.address,
			targetVaultDisplayName: buildVaultDisplayName(selectedVault),
			targetVaultProtocol: selectedVault.protocolName,
			txHash: args.txHash,
			transactionId: args.transactionId,
			bridge: args.bridge,
		},
		quote: rawQuoteCapture
			? {
					requestUrl: rawQuoteCapture.url,
					status: rawQuoteCapture.status,
					ok: rawQuoteCapture.ok,
					responseBody: rawQuoteCapture.body,
			  }
			: null,
		preview: {
			canExecute: preview.canExecute,
			eligibility: preview.eligibility,
			blockingReason: preview.blockingReason,
			fees: preview.fees,
			executionDurationSeconds: preview.executionDurationSeconds,
			routeStepsSummary: preview.routeStepsSummary,
			statusTrackingScope: preview.statusTrackingScope,
		},
		status: statusCapture
			? {
					requestUrl: statusCapture.url,
					status: statusCapture.status,
					ok: statusCapture.ok,
					responseBody: statusCapture.body,
					summary: statusSummary,
			  }
			: null,
		assessment,
	};

	if (args.outputPath) {
		fs.writeFileSync(args.outputPath, JSON.stringify(report, null, 2), 'utf8');
	}

	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const isDirectRun = process.argv[1]
	? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
	: false;

if (isDirectRun) {
	main().catch((error) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
