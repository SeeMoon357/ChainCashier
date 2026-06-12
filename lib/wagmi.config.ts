import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http, injected } from 'wagmi';
import {
	mainnet,
	base,
	arbitrum,
	polygon,
	optimism,
	sepolia,
	baseSepolia,
	arbitrumSepolia,
} from 'wagmi/chains';

const chains = [
	mainnet,
	base,
	arbitrum,
	polygon,
	optimism,
	sepolia,
	baseSepolia,
	arbitrumSepolia,
] as const;

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

export const wagmiConfig = projectId
	? getDefaultConfig({
			appName: 'ChainCashier',
			projectId,
			chains,
			ssr: true,
		})
	: createConfig({
			chains,
			connectors: [injected()],
			transports: Object.fromEntries(
				chains.map((chain) => [chain.id, http()]),
			) as Record<(typeof chains)[number]['id'], ReturnType<typeof http>>,
			ssr: true,
		});
