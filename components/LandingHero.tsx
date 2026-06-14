import Link from 'next/link';
import {
	ArrowRight,
	Bot,
	CheckCircle2,
	LockKeyhole,
	ReceiptText,
	Route,
	ShieldCheck,
	Sparkles,
	Wallet,
	Zap,
} from 'lucide-react';
import BackgroundBlobs from './ui/BackgroundBlobs';
import GlassIsland from './ui/GlassIsland';
import { WalletButton } from './WalletConnect';

const featureCards = [
	{
		title: 'Agent 规划账单',
		kicker: 'GLM-5.1 Agent',
		icon: Bot,
		body: '商家用一句话描述收款需求，Agent 解析金额、目标链、收款地址和费用策略，生成锁定 invoice。',
	},
	{
		title: '聚合跨链流动性',
		kicker: 'LI.FI Fastest Routing',
		icon: Route,
		body: '付款人选择来源链后，系统通过 LI.FI 获取可执行报价，并优先采用快速稳定币路线策略。',
	},
	{
		title: '链上证据闭环',
		kicker: 'On-chain receipt',
		icon: ReceiptText,
		body: '支付完成后展示付款链交易、收款链交易、LI.FI 状态和 receipt hash，方便 Demo 和复核。',
	},
];

const flowSteps = [
	'商家描述收款需求',
	'Agent 创建账单和付款链接',
	'付款人选择来源链',
	'钱包手动确认',
	'LI.FI 执行跨链路由',
	'系统生成可验证收据',
];

const safetyItems = [
	'Agent 不保存私钥',
	'Agent 不自动签名',
	'钱包确认前资金不会移动',
	'链上状态以 scan 链接和 LI.FI 状态为准',
];

const chainTags = ['Base', 'Arbitrum', 'Optimism', 'Polygon'];
const proofTags = ['source tx scan', 'destination tx scan', 'LI.FI status', 'receipt hash'];

/**
 * ChainCashier home 展示页：作为黑客松 Demo 的可滚动 PPT，不承载交易逻辑。
 */
export default function LandingHero() {
	return (
		<main className='relative min-h-screen overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-text)] selection:bg-blue-100 selection:text-blue-900'>
			<BackgroundBlobs />

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

				<div className='absolute right-4 top-6 z-30'>
					<WalletButton />
				</div>
			</header>

			<section className='relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center gap-12 px-6 pb-14 pt-16 lg:min-h-[calc(100vh-5rem)] lg:flex-row lg:gap-20 lg:pb-20 lg:pt-20'>
				<div className='animate-fade-up flex w-full max-w-2xl flex-col items-start'>
					<div className='mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-blue-700 shadow-glass backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-blue-300'>
						<Sparkles className='h-3.5 w-3.5' />
						GLM-5.1 Agent · LI.FI routing · On-chain receipt
					</div>

					<h1 className='font-serif-display text-[2.75rem] leading-[1.05] tracking-tight text-[#1a1c1c] dark:text-gray-50 sm:text-6xl md:text-[4.75rem] lg:text-[5.25rem]'>
						Chat-to-Pay 跨链收银台
					</h1>

					<p className='mt-6 max-w-2xl text-lg font-medium leading-relaxed text-gray-700 dark:text-gray-300 md:text-xl'>
						商家一句话生成 USDC 收款账单，付款人可从 Arbitrum、Optimism、Polygon 或 Base 支付，
						商家在 Base / Arbitrum 收到目标金额。Agent 负责规划，钱包负责签名，LI.FI 负责跨链路由。
					</p>

					<div className='mt-9 flex flex-wrap items-center gap-4'>
						<Link
							href='/chat'
							className='group inline-flex items-center justify-center gap-2 rounded-full border border-white/60 bg-gradient-to-b from-blue-500 to-blue-600 px-9 py-4 text-base font-semibold text-white shadow-pill transition-all hover:-translate-y-0.5 hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_10px_40px_-5px_rgba(59,130,246,0.45)] active:scale-95 md:text-lg'
						>
							开始创建账单
							<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
						</Link>
						<div className='flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400'>
							{['GLM-5.1 Agent', 'LI.FI Fastest Routing', 'Verifiable Receipt'].map((tag) => (
								<span
									key={tag}
									className='rounded-full border border-white/60 bg-white/60 px-3 py-1 font-medium shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5'
								>
									{tag}
								</span>
							))}
						</div>
					</div>

					<div className='mt-8 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
						<span className='font-medium text-gray-400 dark:text-gray-500'>Supported chains:</span>
						{chainTags.map((chain) => (
							<span
								key={chain}
								className='cursor-default rounded-full border border-white/60 bg-white/60 px-2.5 py-1 font-medium text-gray-600 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white/90 hover:text-blue-700 hover:shadow-glass dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-blue-400/40 dark:hover:bg-white/10 dark:hover:text-blue-300'
							>
								{chain}
							</span>
						))}
					</div>
				</div>

				<div className='group animate-fade-in relative w-full max-w-lg flex-1 lg:max-w-2xl'>
					<div className='absolute inset-0 rounded-[3rem] bg-blue-100/50 blur-3xl transition-colors duration-700 group-hover:bg-blue-200/60 dark:bg-blue-500/10 dark:group-hover:bg-blue-500/20' />
					<img
						src='https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1600&auto=format&fit=crop'
						alt='ChainCashier cross-chain checkout'
						className='relative z-10 aspect-[4/3] w-full rounded-[3rem] border-[4px] border-white/50 bg-white object-cover opacity-90 shadow-ambient mix-blend-luminosity transition-transform duration-500 group-hover:scale-[1.03] dark:border-white/10 dark:bg-white/5'
						referrerPolicy='no-referrer'
					/>
				</div>
			</section>

			<section className='relative z-10 mx-auto w-full max-w-[1180px] px-6 pb-14'>
				<div className='grid gap-4 md:grid-cols-3'>
					{featureCards.map((feature) => {
						const Icon = feature.icon;
						return (
							<article
								key={feature.title}
								className='rounded-2xl border border-white/70 bg-white/65 p-5 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-white/5'
							>
								<div className='mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-500/10 dark:text-blue-300'>
									<Icon className='h-5 w-5' />
								</div>
								<div className='text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300'>{feature.kicker}</div>
								<h2 className='mt-2 text-xl font-semibold text-gray-950 dark:text-gray-50'>{feature.title}</h2>
								<p className='mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300'>{feature.body}</p>
							</article>
						);
					})}
				</div>
			</section>

			<section className='relative z-10 mx-auto grid w-full max-w-[1180px] gap-5 px-6 pb-16 lg:grid-cols-[1.2fr_0.8fr]'>
				<div className='rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-7'>
					<div className='mb-5 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300'>
						<Zap className='h-4 w-4' />
						从一句话到链上收据的 Long-Horizon Workflow
					</div>
					<div className='grid gap-3 md:grid-cols-2'>
						{flowSteps.map((step, index) => (
							<div key={step} className='flex items-start gap-3 rounded-2xl border border-white/60 bg-white/55 p-3 dark:border-white/10 dark:bg-white/5'>
								<div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white'>
									{index + 1}
								</div>
								<div className='pt-1 text-sm font-medium text-gray-800 dark:text-gray-100'>{step}</div>
							</div>
						))}
					</div>
				</div>

				<div className='rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:p-7'>
					<div className='mb-5 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300'>
						<ShieldCheck className='h-4 w-4' />
						安全边界
					</div>
					<div className='space-y-3'>
						{safetyItems.map((item) => (
							<div key={item} className='flex items-start gap-3 text-sm leading-6 text-gray-700 dark:text-gray-300'>
								<CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300' />
								<span>{item}</span>
							</div>
						))}
					</div>
					<div className='mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100'>
						<LockKeyhole className='mb-2 h-4 w-4' />
						ChainCashier 不托管资金。用户确认钱包交易后，资金才会从来源链移动，并通过 scan 链接验证。
					</div>
				</div>
			</section>

			<section className='relative z-10 mx-auto w-full max-w-[1180px] px-6 pb-24'>
				<div className='rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:flex md:items-center md:justify-between md:gap-8 md:p-7'>
					<div>
						<div className='flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100'>
							<Wallet className='h-4 w-4 text-blue-600 dark:text-blue-300' />
							Demo evidence package
						</div>
						<p className='mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300'>
							每笔完成付款都会沉淀可复核证据：付款链交易、收款链交易、LI.FI 状态与 receipt hash。
							这让 ChainCashier 不只是生成付款链接，而是完成可追踪的 Web3 收银闭环。
						</p>
					</div>
					<div className='mt-5 flex flex-wrap gap-2 md:mt-0 md:max-w-sm md:justify-end'>
						{proofTags.map((tag) => (
							<span key={tag} className='rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300'>
								{tag}
							</span>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
