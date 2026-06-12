import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';
import Providers from '../components/Providers';

export const metadata = {
	title: 'ChainCashier',
	description: 'AI cross-chain checkout agent for PayFi merchants.',
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang='en'
			suppressHydrationWarning
		>
			<body className='h-full w-full m-0 p-0 overflow-x-hidden overflow-y-auto'>
				<Providers>
					<AntdRegistry>{children}</AntdRegistry>
				</Providers>
			</body>
		</html>
	);
}
