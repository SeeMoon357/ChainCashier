import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import BackgroundBlobs from './ui/BackgroundBlobs';
import GlassIsland from './ui/GlassIsland';
import { WalletButton } from './WalletConnect';

/**
 * ChainCashier 落地页，移植自 zip / AI Studio 的 LandingPage。
 * 入口动画用纯 CSS（globals.css 的 .animate-fade-*），不依赖 motion，
 * 避免 Next.js SSR 下卡在 opacity:0。
 */
export default function LandingHero() {
	return (
		<main className='relative flex min-h-screen flex-col overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-text)] selection:bg-blue-100 selection:text-blue-900'>
			<BackgroundBlobs />

			{/* 顶部品牌胶囊 */}
			<header className='animate-fade-down relative z-20 flex w-full shrink-0 justify-center px-4 pt-6'>
				<GlassIsland className='flex items-center rounded-full border-white/80 bg-white/70 p-1.5 text-sm shadow-sm sm:w-[22rem]'>
					<div className='flex flex-1 items-center justify-center gap-2 border-r border-[#dadada]/50 py-2 dark:border-white/10'>
						<svg
							width='18'
							height='18'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
							className='text-gray-800 dark:text-gray-200'
						>
							<path d='M12 2a10 10 0 1 0 10 10H12V2Z' />
							<path d='M12 12 2.1 7.1' />
							<path d='M12 12l9.9 4.9' />
						</svg>
						<span className='font-semibold tracking-wide text-gray-900 dark:text-gray-100'>ChainCashier</span>
					</div>
					<Link
						href='/chat'
						className='flex flex-1 items-center justify-center whitespace-nowrap py-2 font-medium text-gray-500 transition-all hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
					>
						Chat
					</Link>
				</GlassIsland>

				{/* 右上角：连接钱包 */}
				<div className='absolute right-4 top-6 z-30'>
					<WalletButton />
				</div>
			</header>

			{/* Hero 主体 */}
			<div className='relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center gap-12 px-6 pb-24 pt-10 lg:flex-row lg:gap-24 lg:pt-20'>
				{/* 左：文案 */}
				<div className='animate-fade-up flex w-full max-w-2xl flex-col items-start'>
					<div className='mb-6 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-blue-700 shadow-glass backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-blue-300'>
						<Sparkles className='h-3.5 w-3.5' />
						GLM-5.1 agent · LI.FI cross-chain routing
					</div>

					<h1 className='font-serif-display text-[2.5rem] leading-[1.05] tracking-tight text-[#1a1c1c] dark:text-gray-50 sm:text-6xl md:text-[4.5rem] lg:text-[5rem]'>
						Empower your checkout with cross-chain agents.
					</h1>

					<p className='mt-6 mb-10 max-w-xl text-lg font-medium leading-relaxed text-gray-700 dark:text-gray-300 md:text-xl'>
						Create a locked USDC invoice in chat. Any payer can pay from any chain
						while you receive the exact amount on Base or Arbitrum — the agent plans,
						the wallet signs, LI.FI routes.
					</p>

					<div className='flex flex-wrap items-center gap-4'>
						<Link
							href='/chat'
							className='group inline-flex items-center justify-center gap-2 rounded-full border border-white/60 bg-gradient-to-b from-blue-500 to-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-pill transition-all hover:-translate-y-0.5 hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_10px_40px_-5px_rgba(59,130,246,0.45)] active:scale-95'
						>
							Get Started
							<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
						</Link>
						<span className='text-xs text-gray-400 dark:text-gray-500'>No setup — open the app and start invoicing.</span>
					</div>

					<div className='mt-8 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
						<span className='font-medium text-gray-400 dark:text-gray-500'>Settlement chains:</span>
						{['Base', 'Arbitrum', 'Optimism', 'Polygon'].map((chain) => (
							<span
								key={chain}
								className='cursor-default rounded-full border border-white/60 bg-white/60 px-2.5 py-1 font-medium text-gray-600 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white/90 hover:text-blue-700 hover:shadow-glass dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-blue-400/40 dark:hover:bg-white/10 dark:hover:text-blue-300'
							>
								{chain}
							</span>
						))}
					</div>
				</div>

				{/* 右：插图 */}
				<div className='group animate-fade-in relative w-full max-w-lg flex-1 lg:max-w-2xl'>
					<div className='absolute inset-0 rounded-[3rem] bg-blue-100/50 blur-3xl transition-colors duration-700 group-hover:bg-blue-200/60 dark:bg-blue-500/10 dark:group-hover:bg-blue-500/20' />
					<img
						src='https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1600&auto=format&fit=crop'
						alt='ChainCashier cross-chain checkout'
						className='relative z-10 aspect-[4/3] w-full rounded-[3rem] border-[4px] border-white/50 bg-white object-cover opacity-90 shadow-ambient mix-blend-luminosity transition-transform duration-500 group-hover:scale-[1.03] dark:border-white/10 dark:bg-white/5'
						referrerPolicy='no-referrer'
					/>
				</div>
			</div>
		</main>
	);
}
