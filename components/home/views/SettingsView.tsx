export default function SettingsView() {
	return (
		<div className='p-8 max-w-3xl mx-auto space-y-8'>
			<h2 className='text-4xl font-headline text-on-surface'>
				Orchestrator Settings
			</h2>
			<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl space-y-6'>
				<div className='flex items-center justify-between p-4 bg-stone-900/20 rounded-xl'>
					<div>
						<h4 className='font-bold text-sm'>Divine Mode</h4>
						<p className='text-xs text-stone-500'>
							Enable high-frequency enlightenment protocols.
						</p>
					</div>
					<div className='w-12 h-6 bg-accent-gold rounded-full relative'>
						<div className='absolute right-1 top-1 w-4 h-4 bg-white rounded-full'></div>
					</div>
				</div>
				<div className='flex items-center justify-between p-4 bg-stone-900/20 rounded-xl'>
					<div>
						<h4 className='font-bold text-sm'>Auto-Dharma Rebalancing</h4>
						<p className='text-xs text-stone-500'>
							Automatically adjust assets to maintain perfect karma.
						</p>
					</div>
					<div className='w-12 h-6 bg-stone-700 rounded-full relative'>
						<div className='absolute left-1 top-1 w-4 h-4 bg-white rounded-full'></div>
					</div>
				</div>
			</div>
		</div>
	);
}
