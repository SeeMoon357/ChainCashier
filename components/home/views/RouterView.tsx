import { Check } from 'lucide-react';

export default function RouterView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<div className='flex justify-between items-end'>
				<div>
					<h2 className='text-4xl font-headline text-on-surface'>
						Avatar-Router
					</h2>
					<p className='text-stone-500 mt-2 italic'>
						Mapping the divine flow of assets across 108 dimensions.
					</p>
				</div>
				<div className='bg-accent-gold/10 px-4 py-2 rounded-full border border-accent-gold/20 flex items-center gap-2'>
					<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
					<span className='text-[10px] font-label font-bold text-accent-gold uppercase'>
						Active Routes: 12
					</span>
				</div>
			</div>
			<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
				<div className='lg:col-span-2 bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl relative overflow-hidden'>
					<h3 className='text-xl font-headline text-accent-gold mb-6'>
						Current Pathway Flow
					</h3>
					<div className='h-56 rounded-2xl border border-accent-gold/5 bg-stone-950/40 flex items-center justify-center text-stone-500 italic'>
						Route visualization goes here.
					</div>
				</div>
				<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl'>
					<h3 className='text-xl font-headline text-accent-gold mb-6'>
						Route Optimizer
					</h3>
					<div className='space-y-4'>
						{['Lowest Fee', 'Fastest Path', 'Max Security'].map((opt, i) => (
							<div
								key={opt}
								className={`p-4 rounded-2xl border ${i === 0 ? 'bg-accent-gold/10 border-accent-gold' : 'bg-stone-900/20 border-stone-800'}`}
							>
								<div className='flex justify-between items-center'>
									<span className='text-sm font-bold'>{opt}</span>
									{i === 0 && <Check className='w-4 h-4 text-accent-gold' />}
								</div>
								<p className='text-[10px] text-stone-500 mt-1'>
									Optimizing for enlightened efficiency.
								</p>
							</div>
						))}
					</div>
					<button className='w-full mt-8 py-4 rounded-xl bg-accent-gold text-stone-950 font-bold text-sm uppercase tracking-widest shadow-lg shadow-accent-gold/20'>
						Execute Route
					</button>
				</div>
			</div>
		</div>
	);
}
