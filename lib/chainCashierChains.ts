export type ChainCashierChainKey =
	| 'Base'
	| 'Arbitrum'
	| 'Optimism'
	| 'Polygon';
export type ChainCashierSettlementChainKey = 'Base' | 'Arbitrum';

export type ChainCashierChainConfig = {
	key: ChainCashierChainKey;
	label: string;
	chainId: number;
	usdcAddress: `0x${string}`;
	aliases: string[];
};

export const CHAINCASHIER_USDC_CHAINS: Record<
	ChainCashierChainKey,
	ChainCashierChainConfig
> = {
	Base: {
		key: 'Base',
		label: 'Base',
		chainId: 8453,
		usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		aliases: ['base'],
	},
	Arbitrum: {
		key: 'Arbitrum',
		label: 'Arbitrum',
		chainId: 42161,
		usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
		aliases: ['arbitrum', 'arb'],
	},
	Optimism: {
		key: 'Optimism',
		label: 'Optimism',
		chainId: 10,
		usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
		aliases: ['optimism', 'op', 'op mainnet'],
	},
	Polygon: {
		key: 'Polygon',
		label: 'Polygon',
		chainId: 137,
		usdcAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
		aliases: ['polygon', 'matic'],
	},
};

export const CHAINCASHIER_SETTLEMENT_CHAINS = [
	CHAINCASHIER_USDC_CHAINS.Base,
	CHAINCASHIER_USDC_CHAINS.Arbitrum,
] as const;

export const CHAINCASHIER_PAYMENT_ROUTES: Record<
	ChainCashierSettlementChainKey,
	ChainCashierChainKey[]
> = {
	Base: ['Arbitrum', 'Optimism', 'Polygon'],
	Arbitrum: ['Base'],
};

export function normalizeChainCashierChainKey(
	value: string | undefined,
	defaultKey: ChainCashierSettlementChainKey = 'Base',
): ChainCashierSettlementChainKey {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) {
		return defaultKey;
	}

	for (const chain of CHAINCASHIER_SETTLEMENT_CHAINS) {
		if (
			chain.label.toLowerCase() === normalized ||
			chain.aliases.includes(normalized)
		) {
			return chain.key as ChainCashierSettlementChainKey;
		}
	}

	throw new Error('ChainCashier invoices can receive USDC on Base or Arbitrum.');
}

export function getChainCashierChainById(
	chainId: number,
): ChainCashierChainConfig | null {
	return (
		Object.values(CHAINCASHIER_USDC_CHAINS).find(
			(chain) => chain.chainId === chainId,
		) ?? null
	);
}

export function getChainCashierChainLabel(chainId: number): string {
	return getChainCashierChainById(chainId)?.label ?? `Chain ${chainId}`;
}

export function getChainCashierUsdcAddress(
	chainId: number,
): `0x${string}` | null {
	return getChainCashierChainById(chainId)?.usdcAddress ?? null;
}
