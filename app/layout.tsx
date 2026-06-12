import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';
import Providers from '../components/Providers';

export const metadata = {
	title: 'IntentLens',
	description: 'A mainnet LI.FI Intents flight recorder for builders.',
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
