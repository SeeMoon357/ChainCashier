import { CHAIN_CONFIG_BY_ID, SUPPORTED_EARN_CHAIN_IDS } from './businessChains';

export const SUPPORTED_CHAINS = Object.fromEntries(
	SUPPORTED_EARN_CHAIN_IDS.map((chainId) => [
		chainId,
		{
			name: CHAIN_CONFIG_BY_ID[chainId].name,
			symbol: CHAIN_CONFIG_BY_ID[chainId].nativeSymbol,
			decimals: 18,
		},
	]),
);
