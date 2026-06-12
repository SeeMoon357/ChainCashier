'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
	RainbowKitProvider,
	ConnectButton,
	darkTheme,
	lightTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { createChainCashierWagmiConfig, type WalletRole } from '@/lib/wagmi.config';
import { useTheme } from 'next-themes';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

/**
 * WalletConnect 包装组件
 * 提供钱包连接 UI 和配置
 */
export function WalletConnectProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { theme } = useTheme();
	const pathname = usePathname();
	const [mounted, setMounted] = useState(false);
	const walletRole: WalletRole = pathname?.startsWith('/pay/') ? 'payer' : 'merchant';
	const wagmiConfig = useMemo(
		() => createChainCashierWagmiConfig(walletRole),
		[walletRole],
	);

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setMounted(true));
		return () => window.cancelAnimationFrame(frame);
	}, []);

	const rainbowTheme = mounted && theme === 'dark' ? darkTheme() : lightTheme();

	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitProvider
					theme={rainbowTheme}
					modalSize='compact'
				>
					{children}
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}

/**
 * 钱包按钮组件
 * 显示连接/断开连接按钮，已连接时显示地址
 */
export function WalletButton() {
	return (
		<div className='flex items-center gap-2'>
			<ConnectButton
				accountStatus='address'
				showBalance={true}
				chainStatus='icon'
			/>
		</div>
	);
}

export default WalletButton;
