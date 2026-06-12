'use client';

import { ThemeProvider } from 'next-themes';
import { XProvider } from '@ant-design/x';
import { WalletConnectProvider } from './WalletConnect';

function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute='class'
			defaultTheme='light'
			enableSystem={false}
			themes={['light', 'dark']}
			disableTransitionOnChange
		>
			<WalletConnectProvider>
				<XProvider>{children}</XProvider>
			</WalletConnectProvider>
		</ThemeProvider>
	);
}

export default Providers;
