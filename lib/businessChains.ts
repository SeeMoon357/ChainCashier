export const SUPPORTED_EARN_CHAIN_IDS = [1, 8453, 42161] as const;
export const SUPPORTED_EARN_TARGET_CHAIN_IDS = [1, 8453, 42161, 137] as const;
export const BUSINESS_CHAIN_IDS = [1, 8453, 42161, 137] as const;

export type BusinessChainId = (typeof BUSINESS_CHAIN_IDS)[number];
export type EarnSourceChainId = (typeof SUPPORTED_EARN_CHAIN_IDS)[number];
export type EarnTargetChainId = (typeof SUPPORTED_EARN_TARGET_CHAIN_IDS)[number];

export type BusinessChainConfig = {
	id: BusinessChainId;
	name: string;
	nativeSymbol: string;
	explorerTxBaseUrl: string;
	usdcAddress: string;
	plannerAliases: string[];
	earnEnabled: boolean;
	earnTargetEnabled: boolean;
};

export type CrossChainEarnPair = {
	fromChainId: EarnSourceChainId;
	toChainId: EarnTargetChainId;
};

export const CHAIN_CONFIG_BY_ID: Record<BusinessChainId, BusinessChainConfig> = {
	1: {
		id: 1,
		name: 'Ethereum',
		nativeSymbol: 'ETH',
		explorerTxBaseUrl: 'https://etherscan.io/tx/',
		usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
		plannerAliases: ['ethereum'],
		earnEnabled: true,
		earnTargetEnabled: true,
	},
	8453: {
		id: 8453,
		name: 'Base',
		nativeSymbol: 'ETH',
		explorerTxBaseUrl: 'https://basescan.org/tx/',
		usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		plannerAliases: ['base'],
		earnEnabled: true,
		earnTargetEnabled: true,
	},
	42161: {
		id: 42161,
		name: 'Arbitrum',
		nativeSymbol: 'ETH',
		explorerTxBaseUrl: 'https://arbiscan.io/tx/',
		usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
		plannerAliases: ['arbitrum'],
		earnEnabled: true,
		earnTargetEnabled: true,
	},
	137: {
		id: 137,
		name: 'Polygon',
		nativeSymbol: 'POL',
		explorerTxBaseUrl: 'https://polygonscan.com/tx/',
		usdcAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
		plannerAliases: ['polygon'],
		earnEnabled: false,
		earnTargetEnabled: true,
	},
};

export const SUPPORTED_CROSS_CHAIN_EARN_PAIRS: CrossChainEarnPair[] = [
	{ fromChainId: 1, toChainId: 8453 },
	{ fromChainId: 1, toChainId: 42161 },
	{ fromChainId: 8453, toChainId: 42161 },
	{ fromChainId: 42161, toChainId: 8453 },
	{ fromChainId: 8453, toChainId: 137 },
];

export function getBusinessChainConfig(
	chainId: number,
): BusinessChainConfig | null {
	return CHAIN_CONFIG_BY_ID[chainId as BusinessChainId] ?? null;
}

export function getChainLabel(chainId: number): string {
	return getBusinessChainConfig(chainId)?.name ?? `Chain ${chainId}`;
}

export function getExplorerTxBaseUrl(chainId: number): string {
	return (
		getBusinessChainConfig(chainId)?.explorerTxBaseUrl ??
		'https://basescan.org/tx/'
	);
}

export function getUsdcAddress(chainId: number): string | null {
	return getBusinessChainConfig(chainId)?.usdcAddress ?? null;
}

export function isSupportedEarnChain(chainId: number): chainId is EarnSourceChainId {
	return Boolean(getBusinessChainConfig(chainId)?.earnEnabled);
}

export function isSupportedEarnTargetChain(
	chainId: number,
): chainId is EarnTargetChainId {
	return Boolean(getBusinessChainConfig(chainId)?.earnTargetEnabled);
}

export function isSupportedCrossChainEarnPair(
	fromChain: number,
	toChain: number,
): boolean {
	return SUPPORTED_CROSS_CHAIN_EARN_PAIRS.some(
		(pair) => pair.fromChainId === fromChain && pair.toChainId === toChain,
	);
}

export function getPlannerAliasesByChain(): Array<{
	chainId: BusinessChainId;
	aliases: string[];
}> {
	return BUSINESS_CHAIN_IDS.map((chainId) => ({
		chainId,
		aliases: CHAIN_CONFIG_BY_ID[chainId].plannerAliases,
	}));
}

export function formatSupportedBusinessChainsWithIds(): string {
	return SUPPORTED_EARN_TARGET_CHAIN_IDS.map(
		(chainId) => `${getChainLabel(chainId)}(${chainId})`,
	).join(', ');
}

export function formatSupportedBusinessChainNames(): string {
	return SUPPORTED_EARN_TARGET_CHAIN_IDS.map((chainId) =>
		getChainLabel(chainId),
	).join('、');
}

export function formatSupportedCrossChainEarnTargetsWithIds(): string {
	const destinationChainIds = [
		...new Set(SUPPORTED_CROSS_CHAIN_EARN_PAIRS.map((pair) => pair.toChainId)),
	];

	return destinationChainIds
		.map((chainId) => `${getChainLabel(chainId)}(${chainId})`)
		.join(' or ');
}
