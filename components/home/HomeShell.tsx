/* eslint-disable @next/next/no-img-element */
import { type ReactNode } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import questionIcon from '@/app/question.png';
import { WalletButton } from '@/components/WalletConnect';

export const navItems = [
	{ id: 'dashboard', label: 'Dashboard' },
	{ id: 'auto-agent', label: 'Auto-Agent' },
	{ id: 'analytics', label: 'Analytics' },
	{ id: 'vaults', label: 'Vaults' },
	{ id: 'router', label: 'Router' },
	{ id: 'refinery', label: 'Refinery' },
	{ id: 'executor', label: 'Executor' },
] as const;

export type HomeViewId =
	| (typeof navItems)[number]['id']
	| 'settings'
	| 'insights'
	| 'new-strategy';

type HomeShellProps = {
	currentView: HomeViewId;
	onViewChange: (view: HomeViewId) => void;
	onToggleTheme: () => void;
	children: ReactNode;
};

export default function HomeShell({
	currentView,
	onViewChange,
	onToggleTheme,
	children,
}: HomeShellProps) {
	return (
		<div className='min-h-screen relative overflow-x-hidden bg-surface dark:bg-stone-950 text-on-surface dark:text-stone-50 selection:bg-accent-gold/30'>
			<div className='fixed inset-0 pointer-events-none z-0 overflow-hidden'>
				<motion.div
					animate={{ rotate: 360 }}
					transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
					className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vmax] h-[120vmax] opacity-[0.03]'
				>
					{[...Array(24)].map((_, i) => (
						<div
							key={i}
							style={{
								transform: `translate(-50%, -50%) rotate(${i * 15}deg)`,
							}}
							className='absolute top-1/2 left-1/2 w-full h-[1px] bg-accent-gold'
						/>
					))}
					{[...Array(3)].map((_, i) => (
						<div
							key={i}
							style={{ width: `${(i + 1) * 30}%`, height: `${(i + 1) * 30}%` }}
							className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-accent-gold rounded-full'
						/>
					))}
				</motion.div>
				<div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vmax] h-[150vmax] opacity-10'>
					{[...Array(12)].map((_, i) => (
						<motion.div
							key={i}
							initial={{ rotate: i * 30, scale: 0.8, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ duration: 2, delay: i * 0.1, ease: 'easeOut' }}
							className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-accent-gold to-transparent'
						/>
					))}
				</div>
				<div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-accent-gold/5 blur-[120px]' />
			</div>

			<motion.div
				initial={{ opacity: 0, scale: 1.1 }}
				animate={{ opacity: 0.08, scale: 1 }}
				transition={{ duration: 3 }}
				className='fixed bottom-[-10%] left-[-10%] w-[60%] pointer-events-none z-0'
			>
				<img
					className='w-full h-auto'
					alt='a large elegant line art illustration of a blooming lotus flower'
					src='https://lh3.googleusercontent.com/aida-public/AB6AXuC3YpnY9flUgdIGfJfahlZkoSL-fu3LeFRJFCVGQ5mGvPpwEM_Ptim-53e49OX06-iDuOiedUFtP9cTT7mAJRRL1G7R1GkEhjdVQOyzRrsnzyXw3MpGQslfgZBDOpxcLfBvVDhzZRrIBJj_QbrnH8iwdsEuLevyuOFl1JqTbMIXlDEWCsyd28OuMzNXroUjrdgShwSwaSG7wLjC92VXTYYvz-WTwZCfCo-VKUE3629YuH1pw1k4avmbFU36KU_viJwI_1nkorpwZoa6'
				/>
			</motion.div>

			<header className='fixed top-0 inset-x-0 h-16 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-md border-b border-stone-200/20 dark:border-stone-800/20 flex justify-between items-center px-8 z-40'>
				<div className='flex items-center gap-4'>
					<span className='text-xl font-headline font-bold text-stone-900 dark:text-stone-100'>
						IntentLens
					</span>
					<span className='bg-primary/10 text-primary text-[10px] px-2 py-1 rounded-full font-label font-bold border border-primary/20'>
						MAINNET LENS
					</span>
				</div>

				<div className='flex items-center gap-4'>
					<div className='flex items-center gap-4'>
						<div className='flex items-center gap-3'>
							<button
								onClick={onToggleTheme}
								className='cursor-pointer w-8 h-8 rounded-full border-none outline-none ring-0 hover:bg-accent-gold/10 text-emerald-700 dark:text-emerald-400 transition-colors flex items-center justify-center'
							>
								<span className='theme-icon-moon dark:hidden'>🌙</span>
								<span className='theme-icon-sun hidden dark:block'>☀️</span>
							</button>

							<button
								aria-label='Help'
								className='cursor-pointer w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent-gold/10 text-emerald-700 dark:text-emerald-400 transition-colors'
							>
								<Image
									src={questionIcon}
									alt='Help'
									width={18}
									height={18}
									className='theme-adaptive-icon'
								/>
							</button>

							<WalletButton />
						</div>
					</div>
				</div>
			</header>

			<main className='pt-16 pb-16 min-h-screen z-10 relative'>{children}</main>
		</div>
	);
}
