import { motion } from 'motion/react';
import { Zap } from 'lucide-react';

export default function ExecutorView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<div className='flex items-center justify-between'>
				<h2 className='text-4xl font-headline text-on-surface'>
					Vajra-Executor
				</h2>
				<div className='flex gap-4'>
					<div className='flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20'>
						<div className='w-2 h-2 rounded-full bg-emerald-500'></div>
						<span className='text-[10px] font-bold text-emerald-500 uppercase'>
							System Nominal
						</span>
					</div>
				</div>
			</div>
			<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
				<div className='bg-stone-950 rounded-3xl p-8 border border-accent-gold/10 shadow-2xl font-mono relative overflow-hidden'>
					<div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-gold to-transparent opacity-50'></div>
					<h3 className='text-sm text-accent-gold mb-6 flex items-center gap-2'>
						<Zap className='w-4 h-4' /> EXECUTION_LOG_STREAM
					</h3>
					<div className='space-y-2 text-[11px] text-emerald-500/80'>
						<p>
							<span className='text-stone-600'>[01:24:07]</span> Initializing
							Vajra Core...
						</p>
						<p>
							<span className='text-stone-600'>[01:24:08]</span> Synchronizing
							48 nodes across shards...
						</p>
						<p>
							<span className='text-stone-600'>[01:24:09]</span>{' '}
							<span className='text-accent-gold'>SUCCESS:</span> All nodes
							online.
						</p>
						<p>
							<span className='text-stone-600'>[01:24:10]</span> Scanning
							liquidity pools for arbitrage...
						</p>
						<p>
							<span className='text-stone-600'>[01:24:11]</span> Found
							opportunity in ETH/USDC (Uniswap v3)
						</p>
						<p>
							<span className='text-stone-600'>[01:24:12]</span> Calculating
							optimal path via Avatar-Router...
						</p>
						<motion.p
							animate={{ opacity: [1, 0.5, 1] }}
							transition={{ duration: 1, repeat: Infinity }}
						>
							<span className='text-stone-600'>[01:24:13]</span> Awaiting divine
							confirmation...
						</motion.p>
					</div>
				</div>
				<div className='space-y-6'>
					<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl'>
						<h3 className='text-xl font-headline text-accent-gold mb-4'>
							Node Health Map
						</h3>
						<div className='grid grid-cols-8 gap-2'>
							{[...Array(48)].map((_, i) => (
								<motion.div
									key={i}
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ delay: i * 0.01 }}
									className='aspect-square rounded-sm bg-emerald-500/40 border border-emerald-500/20 hover:bg-emerald-500 transition-colors cursor-help'
									title={`Node ${i + 1}: Healthy`}
								/>
							))}
						</div>
					</div>
					<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl'>
						<h3 className='text-xl font-headline text-accent-gold mb-4'>
							Manual Override
						</h3>
						<div className='flex gap-4'>
							<button className='flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all'>
								Emergency Stop
							</button>
							<button className='flex-1 py-3 rounded-xl bg-accent-gold/10 border border-accent-gold/20 text-accent-gold font-bold text-xs uppercase tracking-widest hover:bg-accent-gold hover:text-stone-950 transition-all'>
								Force Sync
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
