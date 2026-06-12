import { Shield } from 'lucide-react';

export default function VaultsView() {
	return (
		<div className='p-8 max-w-7xl mx-auto space-y-8'>
			<h2 className='text-4xl font-headline text-on-surface'>
				Abhaya-Giver Vaults
			</h2>
			<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
				{['Lotus Vault', 'Vajra Safe', 'Amrita Pool'].map((vault) => (
					<div
						key={vault}
						className='bg-surface-container rounded-2xl p-6 border border-accent-gold/10 hover:border-accent-gold/30 transition-all'
					>
						<Shield className='w-8 h-8 text-accent-gold mb-4' />
						<h3 className='text-lg font-headline mb-2'>{vault}</h3>
						<p className='text-sm text-stone-500 mb-4'>
							Secured by divine encryption and multi-sig dharma.
						</p>
						<button className='w-full py-2 rounded-lg bg-accent-gold/10 text-accent-gold font-bold text-xs uppercase tracking-widest'>
							Manage
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
