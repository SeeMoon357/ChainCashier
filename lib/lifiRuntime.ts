export type NormalizedVaultCandidate = {
	address: string;
	chainId: number;
	name: string;
	protocolName: string;
	underlyingSymbol: string;
	underlyingTokenAddress: string;
	apyTotal: number;
	tvlUsd: number;
	tags: string[];
	isTransactional: boolean;
	isRedeemable: boolean;
	dataSource: 'live' | 'fallback';
};

export type VaultListSuccess = {
	success: true;
	vaults: NormalizedVaultCandidate[];
};

export type VaultListFailure = {
	success: false;
	errorCode: 'vault_list_payload_invalid';
	error: string;
	vaults: [];
};

export type NormalizedPortfolioPosition = {
	chainId: number;
	protocolName: string;
	assetAddress: string;
	assetSymbol: string;
	balanceUsd: number;
	balanceNative: number;
};

type RawVaultRecord = {
	address?: unknown;
	chainId?: unknown;
	name?: unknown;
	protocol?: unknown;
	underlyingTokens?: unknown;
	tags?: unknown;
	isTransactional?: unknown;
	isRedeemable?: unknown;
	analytics?: unknown;
};

function asFiniteNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeProtocolName(protocol: unknown): string {
	if (typeof protocol === 'string' && protocol.trim()) {
		return protocol.trim();
	}

	if (
		protocol &&
		typeof protocol === 'object' &&
		typeof (protocol as { name?: unknown }).name === 'string'
	) {
		return ((protocol as { name: string }).name || '').trim();
	}

	return 'unknown';
}

function normalizeUnderlyingToken(
	value: unknown,
): { symbol: string; address: string } {
	const token = Array.isArray(value) ? value[0] : null;
	if (token && typeof token === 'object') {
		return {
			symbol:
				typeof (token as { symbol?: unknown }).symbol === 'string'
					? ((token as { symbol: string }).symbol || '').trim().toUpperCase()
					: '',
			address:
				typeof (token as { address?: unknown }).address === 'string'
					? ((token as { address: string }).address || '').trim()
					: '',
		};
	}

	return { symbol: '', address: '' };
}

function normalizeTags(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function normalizeVaultRecord(rawVault: RawVaultRecord): NormalizedVaultCandidate {
	const underlying = normalizeUnderlyingToken(rawVault.underlyingTokens);
	const analytics = rawVault.analytics as
		| {
				apy?: { total?: unknown };
				tvl?: { usd?: unknown };
		  }
		| undefined;

	return {
		address:
			typeof rawVault.address === 'string' ? rawVault.address.trim() : '',
		chainId: asFiniteNumber(rawVault.chainId),
		name: typeof rawVault.name === 'string' ? rawVault.name.trim() : 'Unknown',
		protocolName: normalizeProtocolName(rawVault.protocol),
		underlyingSymbol: underlying.symbol || 'UNKNOWN',
		underlyingTokenAddress: underlying.address,
		apyTotal: asFiniteNumber(analytics?.apy?.total),
		tvlUsd: asFiniteNumber(analytics?.tvl?.usd),
		tags: normalizeTags(rawVault.tags),
		isTransactional: Boolean(rawVault.isTransactional),
		isRedeemable: Boolean(rawVault.isRedeemable),
		dataSource: 'live',
	};
}

export function normalizeVaultDetailResponse(
	raw: unknown,
): NormalizedVaultCandidate | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}

	return normalizeVaultRecord(raw as RawVaultRecord);
}

export function buildVaultDisplayName(input: {
	name: string;
	protocolName: string;
	underlyingSymbol: string;
}): string {
	const normalizedName = input.name.trim();
	const normalizedProtocol = input.protocolName.trim();
	const normalizedUnderlying = input.underlyingSymbol.trim().toUpperCase();

	if (
		normalizedName &&
		normalizedName !== 'Unknown' &&
		normalizedName.toUpperCase() !== normalizedUnderlying
	) {
		return normalizedName;
	}

	if (normalizedUnderlying && normalizedProtocol && normalizedProtocol !== 'unknown') {
		return `${normalizedUnderlying} vault on ${normalizedProtocol}`;
	}

	if (normalizedUnderlying) {
		return `${normalizedUnderlying} vault`;
	}

	return normalizedName || 'Unknown vault';
}

export function normalizeVaultListResponse(
	raw: unknown,
): VaultListSuccess | VaultListFailure {
	if (Array.isArray(raw)) {
		return {
			success: true,
			vaults: raw.map((vault) => normalizeVaultRecord(vault as RawVaultRecord)),
		};
	}

	if (raw && typeof raw === 'object') {
		const payload = raw as {
			data?: unknown;
			error?: unknown;
			message?: unknown;
		};

		if (Array.isArray(payload.data)) {
			return {
				success: true,
				vaults: payload.data.map((vault) =>
					normalizeVaultRecord(vault as RawVaultRecord),
				),
			};
		}

		const errorMessage =
			typeof payload.error === 'string'
				? payload.error
				: typeof payload.message === 'string'
					? payload.message
					: 'Unexpected LI.FI vault payload.';

		return {
			success: false,
			errorCode: 'vault_list_payload_invalid',
			error: errorMessage,
			vaults: [],
		};
	}

	return {
		success: false,
		errorCode: 'vault_list_payload_invalid',
		error: 'Unexpected LI.FI vault payload.',
		vaults: [],
	};
}

export function normalizePortfolioPositionsResponse(
	raw: unknown,
): NormalizedPortfolioPosition[] {
	const positions = Array.isArray(
		(raw as { positions?: unknown } | null)?.positions,
	)
		? ((raw as { positions: unknown[] }).positions ?? [])
		: [];

	return positions
		.map((position) => {
			const item = position as {
				chainId?: unknown;
				protocolName?: unknown;
				asset?: { address?: unknown; symbol?: unknown };
				balanceUsd?: unknown;
				balanceNative?: unknown;
			};

			return {
				chainId: asFiniteNumber(item.chainId),
				protocolName:
					typeof item.protocolName === 'string' ? item.protocolName : 'unknown',
				assetAddress:
					typeof item.asset?.address === 'string' ? item.asset.address : '',
				assetSymbol:
					typeof item.asset?.symbol === 'string'
						? item.asset.symbol.toUpperCase()
						: '',
				balanceUsd: asFiniteNumber(item.balanceUsd),
				balanceNative: asFiniteNumber(item.balanceNative),
			};
		})
		.filter((position) => position.assetSymbol === 'USDC');
}

export function rankVaultCandidates(
	vaults: NormalizedVaultCandidate[],
	options: {
		minApy?: number | null;
		limit?: number | null;
		riskPreference?: 'low' | 'medium' | 'high';
	} = {},
): NormalizedVaultCandidate[] {
	const limit =
		typeof options.limit === 'number' && Number.isFinite(options.limit)
			? Math.max(1, Math.floor(options.limit))
			: 3;

	const preferred = vaults.filter(
		(vault) =>
			vault.underlyingSymbol === 'USDC' &&
			vault.isTransactional &&
			vault.dataSource === 'live',
	);

	const minApy =
		typeof options.minApy === 'number' && Number.isFinite(options.minApy)
			? options.minApy
			: null;

	const eligible =
		minApy == null
			? preferred
			: preferred.filter((vault) => vault.apyTotal >= minApy);

	const sortedPreferred = preferred
		.slice()
		.sort((left, right) => {
			const apyDiff = right.apyTotal - left.apyTotal;
			if (apyDiff !== 0) {
				return apyDiff;
			}

			return right.tvlUsd - left.tvlUsd;
		});

	const primary = eligible.length > 0 ? eligible : sortedPreferred;
	const remainder = sortedPreferred.filter(
		(vault) => !primary.some((selected) => selected.address === vault.address),
	);

	return [...primary, ...remainder].slice(0, limit);
}

export function summarizeVaultSearchOutcome(input: {
	chainName: string;
	token: string;
	totalVaultCount: number;
	matchingTokenCount: number;
	transactionalCount: number;
	selectedVault: Pick<
		NormalizedVaultCandidate,
		'name' | 'protocolName' | 'apyTotal' | 'underlyingSymbol'
	> | null;
}): string {
	const token = input.token.trim().toUpperCase() || 'USDC';

	if (input.selectedVault) {
		return `Found ${input.matchingTokenCount} live ${token} vaults on ${input.chainName}. Best candidate is ${input.selectedVault.name} on ${input.selectedVault.protocolName} at ${input.selectedVault.apyTotal.toFixed(2)}% APY.`;
	}

	if (input.totalVaultCount === 0) {
		return `No live vault data was returned on ${input.chainName}.`;
	}

	if (input.matchingTokenCount === 0) {
		return `Live vault data was returned on ${input.chainName}, but none of the current results matched ${token}.`;
	}

	if (input.transactionalCount === 0) {
		return `Live ${token} vault data was returned on ${input.chainName}, but none of the current results are open for deposits.`;
	}

	return `Live ${token} vault data was returned on ${input.chainName}, but local ranking did not produce a candidate.`;
}

export function buildRecommendationSummary(input: {
	chainName: string;
	dataSource: 'live' | 'fallback';
	fallbackReason?: string;
	selectedVault: NormalizedVaultCandidate | null;
	alternatives: NormalizedVaultCandidate[];
}): string {
	const lines = [`Source: ${input.dataSource}`];

	if (input.dataSource === 'fallback' && input.fallbackReason) {
		lines.push(input.fallbackReason);
	}

	if (input.selectedVault) {
		const displayName = buildVaultDisplayName(input.selectedVault);
		lines.push(
			`Recommendation: ${displayName} on ${input.chainName}`,
		);
		lines.push(
			`APY: ${input.selectedVault.apyTotal.toFixed(2)}% | TVL: $${input.selectedVault.tvlUsd.toLocaleString(
				'en-US',
			)}`,
		);
	} else {
		lines.push(`No live USDC vault recommendation is available on ${input.chainName}.`);
	}

	if (input.alternatives.length > 0) {
		lines.push('Alternatives:');
		for (const vault of input.alternatives) {
			const displayName = buildVaultDisplayName(vault);
			lines.push(
				`- ${displayName} (${vault.protocolName}) ${vault.apyTotal.toFixed(2)}% APY`,
			);
		}
	}

	return lines.join('\n');
}
