export default function NewStrategyView() {
	return (
		<div className='p-8 max-w-4xl mx-auto space-y-8'>
			<div className='text-center space-y-2'>
				<h2 className='text-4xl font-headline text-on-surface'>
					Invoke New Dharma Path
				</h2>
				<p className='text-stone-500 italic'>
					Define your intent and manifest a new AI-driven strategy.
				</p>
			</div>
			<div className='bg-accent-gold/5 border border-accent-gold/20 rounded-3xl p-8 text-center gold-glow'>
				<div className='max-w-md mx-auto space-y-4'>
					<p className='text-sm italic text-stone-400'>
						&quot;By clicking Invoke, you align your capital with the chosen
						Dharma. The Thousand-Hand Orchestrator will begin execution across
						all shards.&quot;
					</p>
					<button className='w-full py-4 rounded-2xl bg-accent-gold text-stone-950 font-bold text-sm uppercase tracking-[0.2em] shadow-2xl shadow-accent-gold/20 hover:scale-[1.02] transition-transform'>
						Invoke Strategy
					</button>
				</div>
			</div>
		</div>
	);
}
