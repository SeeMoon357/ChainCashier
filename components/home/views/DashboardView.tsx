import { type ComponentType } from 'react';
import { motion } from 'motion/react';
import {
	Check,
	Droplet,
	Eye,
	Hand,
	Route,
	Shield,
	Sparkles,
	Wallet,
	Zap,
} from 'lucide-react';

function ShellCard({
	label,
	title,
	desc,
	icon: Icon,
	highlight,
}: {
	label: string;
	title: string;
	desc: string;
	icon: ComponentType<{ className?: string }>;
	highlight?: boolean;
}) {
	return (
		<div
			className={`rounded-3xl p-7 border shadow-lg ${highlight ? 'bg-primary text-surface border-accent-gold/30' : 'bg-surface-container-lowest border-accent-gold/10'}`}
		>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<p
						className={`text-[10px] font-label uppercase tracking-[0.2em] font-bold ${highlight ? 'text-surface/70' : 'text-accent-gold'}`}
					>
						{label}
					</p>
					<h3 className='mt-2 text-2xl font-headline'>{title}</h3>
				</div>
				<div
					className={`rounded-2xl p-3 ${highlight ? 'bg-surface/15' : 'bg-accent-gold/10'}`}
				>
					<Icon
						className={`w-6 h-6 ${highlight ? 'text-surface' : 'text-accent-gold'}`}
					/>
				</div>
			</div>
			<p
				className={`mt-6 text-sm leading-relaxed ${highlight ? 'text-surface/80' : 'text-on-surface-variant'}`}
			>
				{desc}
			</p>
		</div>
	);
}

export default function DashboardView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<motion.section
				initial={{ y: 20, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				className='bg-surface-container rounded-3xl p-8 relative overflow-hidden border border-accent-gold/10 shadow-xl gold-glow'
			>
				<div className='absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-accent-gold/10 to-transparent'></div>
				<div className='relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6'>
					<div className='max-w-2xl'>
						<div className='flex items-center gap-2 mb-4'>
							<Hand className='w-5 h-5 text-accent-gold' />
							<span className='text-[10px] font-label font-bold uppercase tracking-[0.2em] text-accent-gold'>
								Infinite Compassion & Power
							</span>
						</div>
						<h2 className='text-4xl font-headline text-on-surface mb-3 leading-tight'>
							The <span className='text-accent-gold italic'>Thousand-Hand</span>{' '}
							Orchestrator
						</h2>
						<p className='text-on-surface-variant font-body text-lg leading-relaxed'>
							A divine gateway to liquid markets, high-frequency AI strategies,
							and enlightened vault management.
						</p>
					</div>
					<motion.div
						whileHover={{ scale: 1.02 }}
						className='bg-surface-container-lowest/80 backdrop-blur border border-accent-gold/20 p-5 rounded-2xl max-w-xs shadow-lg'
					>
						<div className='flex items-center gap-2 text-accent-gold mb-2'>
							<Sparkles className='w-4 h-4' />
							<span className='text-[10px] font-label font-bold uppercase tracking-tighter'>
								DIVINE INSIGHT
							</span>
						</div>
						<p className='text-sm italic text-on-surface-variant leading-relaxed'>
							&quot;The flow of capital is but a ripple in the ocean of wisdom.
							Align your intent with the market&apos;s natural dharma.&quot;
						</p>
					</motion.div>
				</div>
			</motion.section>

			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
				<ShellCard
					label='Jewel-Holder'
					title='Integrated Wallets'
					desc='Wallet visibility and balance management across the orchestration surface.'
					icon={Wallet}
				/>
				<ShellCard
					label='Wisdom-Eye'
					title='APY Matrix'
					desc='Yield views and protocol performance summaries for active strategies.'
					icon={Eye}
				/>
				<ShellCard
					label='Abhaya-Giver'
					title='Risk Shield'
					desc='Vault exposure and safety indicators for the current portfolio.'
					icon={Shield}
				/>
				<ShellCard
					label='Avatar-Router'
					title='Pathway Flow'
					desc='Cross-chain routing and route selection for asset movement.'
					icon={Route}
				/>
				<ShellCard
					label='Amrita-Refinery'
					title='Income Analysis'
					desc='Compounding and weekly yield analysis for treasury flows.'
					icon={Droplet}
				/>
				<ShellCard
					label='Vajra-Executor'
					title='Node Execution'
					desc='Execution nodes, batching, and controlled transaction dispatch.'
					icon={Zap}
					highlight
				/>
			</div>

			<section className='bg-surface-container-lowest rounded-xl p-8 shadow-sm border border-outline-variant/10'>
				<div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8'>
					<div>
						<h2 className='text-2xl font-headline text-on-surface'>
							48-Hour Sprint Plan
						</h2>
						<p className='text-on-surface-variant text-sm'>
							Aggressive refinement schedule for production orchestration.
						</p>
					</div>
					<div className='flex bg-surface-container-low p-1 rounded-xl'>
						<button className='px-6 py-2 rounded-lg bg-surface text-primary font-bold text-sm shadow-sm'>
							Day 1
						</button>
						<button className='px-6 py-2 rounded-lg text-stone-400 font-bold text-sm hover:text-primary transition-colors'>
							Day 2
						</button>
					</div>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
					<div className='space-y-4'>
						<div className='flex items-start gap-4 p-4 bg-primary/5 rounded-xl border-l-4 border-primary'>
							<div className='w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center shrink-0 mt-1'>
								<Check className='w-3 h-3 text-primary' />
							</div>
							<div>
								<h4 className='font-bold font-body text-sm'>
									Asset Protocol Verification
								</h4>
								<p className='text-xs text-on-surface-variant mt-1'>
									Audit all L1/L2 bridge endpoints for maximum liquidity depth.
								</p>
							</div>
						</div>
						<div className='flex items-start gap-4 p-4 hover:bg-stone-50 transition-colors rounded-xl'>
							<div className='w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center shrink-0 mt-1'></div>
							<div>
								<h4 className='font-bold font-body text-sm text-on-surface'>
									Shard Synchronization
								</h4>
								<p className='text-xs text-stone-500 mt-1'>
									Connect all 48 execution nodes to the Vajra core engine.
								</p>
							</div>
						</div>
					</div>
					<div className='space-y-4'>
						<div className='flex items-start gap-4 p-4 hover:bg-stone-50 transition-colors rounded-xl'>
							<div className='w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center shrink-0 mt-1'></div>
							<div>
								<h4 className='font-bold font-body text-sm text-on-surface'>
									Oracle Sensitivity Calibration
								</h4>
								<p className='text-xs text-stone-500 mt-1'>
									Tune Wisdom-Eye matrix to filter low-confidence market noise.
								</p>
							</div>
						</div>
						<div className='flex items-start gap-4 p-4 hover:bg-stone-50 transition-colors rounded-xl'>
							<div className='w-6 h-6 rounded-full border-2 border-outline-variant flex items-center justify-center shrink-0 mt-1'></div>
							<div>
								<h4 className='font-bold font-body text-sm text-on-surface'>
									Final Stress Test
								</h4>
								<p className='text-xs text-stone-500 mt-1'>
									Simulate 500% spike in transaction volume for stability check.
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
