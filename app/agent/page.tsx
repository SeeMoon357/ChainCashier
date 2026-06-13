'use client';

import Sidebar from '@/components/Sidebar';
import ChatContent from '@/components/ChatContent';
import BackgroundBlobs from '@/components/ui/BackgroundBlobs';

export default function AgentPage() {
	return (
		<div className='relative flex h-screen w-full overflow-hidden [background:var(--app-bg)] [color:var(--app-text)] antialiased'>
			<BackgroundBlobs />
			<Sidebar />
			<main className='relative z-10 flex min-w-0 flex-1 flex-col'>
				<ChatContent />
			</main>
		</div>
	);
}
