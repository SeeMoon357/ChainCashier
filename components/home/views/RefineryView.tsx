import { motion } from 'motion/react';
import { Droplet, Hand, Sparkles, Zap } from 'lucide-react';

export default function RefineryView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<h2 className='text-4xl font-headline text-on-surface'>
				Amrita-Refinery
			</h2>
			<div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
				{[
					{ label: 'Raw Yield', val: '14.2%', icon: Droplet },
					{ label: 'Refined APY', val: '18.5%', icon: Sparkles },
					{ label: 'Gas Saved', val: '$1,240', icon: Zap },
					{ label: 'Karma Score', val: '99.8', icon: Hand },
				].map((stat) => (
					<div
						key={stat.label}
						className='bg-surface-container rounded-2xl p-6 border border-accent-gold/10'
					>
						<stat.icon className='w-5 h-5 text-accent-gold mb-2' />
						<p className='text-[10px] font-label text-stone-500 uppercase'>
							{stat.label}
						</p>
						<p className='text-2xl font-bold text-on-surface'>{stat.val}</p>
					</div>
				))}
			</div>
			<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl'>
				<h3 className='text-xl font-headline text-accent-gold mb-6'>
					Income Refinement Process
				</h3>
				<div className='space-y-6'>
					{[
						{ step: 'Harvesting', progress: 100, status: 'Complete' },
						{ step: 'Compounding', progress: 75, status: 'In Progress' },
						{ step: 'Dharma Rebalancing', progress: 30, status: 'Queued' },
					].map((p) => (
						<div key={p.step}>
							<div className='flex justify-between text-xs font-label mb-2'>
								<span className='text-on-surface font-bold'>{p.step}</span>
								<span className='text-accent-gold'>
									{p.status} ({p.progress}%)
								</span>
							</div>
							<div className='w-full h-3 bg-stone-900/50 rounded-full overflow-hidden border border-accent-gold/5'>
								<motion.div
									initial={{ width: 0 }}
									animate={{ width: `${p.progress}%` }}
									transition={{ duration: 1.5 }}
									className='h-full bg-gradient-to-r from-accent-gold/40 to-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
