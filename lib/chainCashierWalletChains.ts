import type { Chain } from 'viem';
import { arbitrum, base, optimism, polygon } from 'wagmi/chains';

const chainCashierWalletChains: Record<number, Chain> = {
	[base.id]: base,
	[arbitrum.id]: arbitrum,
	[optimism.id]: optimism,
	[polygon.id]: polygon,
};

export function getChainCashierWalletChain(chainId: number): Chain | undefined {
	return chainCashierWalletChains[chainId];
}
