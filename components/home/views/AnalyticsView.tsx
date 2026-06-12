export default function AnalyticsView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<h2 className='text-4xl font-headline text-on-surface'>
				Wisdom-Eye Analytics
			</h2>
			<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
				<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl'>
					<h3 className='text-xl font-headline text-accent-gold mb-4'>
						Performance Matrix
					</h3>
					<div className='h-64 bg-stone-900/50 rounded-xl flex items-center justify-center border border-accent-gold/5'>
						<span className='text-stone-500 italic'>
							Visualizing market flows...
						</span>
					</div>
				</div>
				<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl'>
					<h3 className='text-xl font-headline text-accent-gold mb-4'>
						Yield Distribution
					</h3>
					<div className='h-64 bg-stone-900/50 rounded-xl flex items-center justify-center border border-accent-gold/5'>
						<span className='text-stone-500 italic'>
							Calculating enlightened returns...
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
