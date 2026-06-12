import { Brain } from 'lucide-react';

export default function InsightsView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<h2 className='text-4xl font-headline text-on-surface'>
				Divine Insights
			</h2>
			<div className='bg-surface-container rounded-3xl p-8 border border-accent-gold/10 shadow-xl gold-glow'>
				<div className='flex items-center gap-4 mb-6'>
					<Brain className='w-10 h-10 text-accent-gold' />
					<div>
						<h3 className='text-xl font-headline'>AI Oracle Analysis</h3>
						<p className='text-sm text-stone-500'>
							Processing cosmic market data...
						</p>
					</div>
				</div>
				<p className='text-lg italic text-on-surface-variant leading-relaxed border-l-4 border-accent-gold pl-6'>
					&quot;The current market alignment suggests a period of high liquidity
					in the Lotus sector. Consider reallocating 15% of Vajra reserves to
					capitalize on the rising tide of compassion.&quot;
				</p>
			</div>
		</div>
	);
}
