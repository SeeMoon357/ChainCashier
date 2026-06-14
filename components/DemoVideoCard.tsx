'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';

const DEMO_VIDEO_SRC = '/demo/chaincashier-demo.mp4';

export default function DemoVideoCard() {
	const [isOpen, setIsOpen] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const previousOverflow = document.body.style.overflow;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false);
		};

		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) return;
		videoRef.current?.pause();
	}, [isOpen]);

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className='group animate-fade-in relative w-full max-w-lg flex-1 cursor-pointer border-0 bg-transparent p-0 text-left lg:max-w-2xl'
				aria-label='Play ChainCashier 2-min Demo Video'
			>
				<div className='absolute inset-0 rounded-[3rem] bg-blue-100/50 blur-3xl transition-colors duration-700 group-hover:bg-blue-200/60 dark:bg-blue-500/10 dark:group-hover:bg-blue-500/20' />
				<div className='relative z-10 flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-[3rem] border-[4px] border-white/50 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.92),transparent_34%),linear-gradient(135deg,rgba(184,134,47,0.18),rgba(59,130,246,0.22))] p-7 shadow-ambient backdrop-blur-xl transition-transform duration-500 group-hover:scale-[1.03] dark:border-white/10 dark:bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.13),transparent_34%),linear-gradient(135deg,rgba(184,134,47,0.16),rgba(59,130,246,0.18))]'>
					<div className='flex items-center justify-between gap-4'>
						<span className='rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-blue-200'>
							2-min Demo Video
						</span>
						<span className='rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-gray-300'>
							Watch overview
						</span>
					</div>

					<div className='grid flex-1 place-items-center'>
						<div className='flex h-24 w-24 items-center justify-center rounded-full border border-white/80 bg-white/80 text-blue-600 shadow-[0_18px_60px_rgba(59,130,246,0.28)] backdrop-blur-md transition-transform duration-300 group-hover:scale-110 dark:border-white/10 dark:bg-white/15 dark:text-blue-200'>
							<Play className='ml-1 h-10 w-10 fill-current' />
						</div>
					</div>

					<div>
						<div className='font-serif-display text-4xl leading-tight text-gray-950 dark:text-white md:text-5xl'>
							See ChainCashier in action.
						</div>
						<p className='mt-3 max-w-lg text-base font-medium leading-7 text-gray-700 dark:text-gray-300'>
							从商家建单、付款人选链、钱包确认，到 LI.FI 路由和链上 receipt，一段视频看完整流程。
						</p>
					</div>
				</div>
			</button>

			{isOpen ? (
				<div
					className='fixed inset-0 z-50 flex items-center justify-center bg-gray-950/75 p-4 backdrop-blur-md'
					onClick={() => setIsOpen(false)}
					role='dialog'
					aria-modal='true'
					aria-label='ChainCashier demo video player'
				>
					<div
						className='relative w-full max-w-5xl rounded-[2rem] border border-white/15 bg-black p-3 shadow-[0_30px_120px_rgba(0,0,0,0.45)]'
						onClick={(event) => event.stopPropagation()}
					>
						<button
							type='button'
							onClick={() => setIsOpen(false)}
							className='absolute -right-3 -top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white text-gray-950 shadow-lg transition hover:scale-105'
							aria-label='Close demo video'
						>
							<X className='h-5 w-5' />
						</button>
						<video
							ref={videoRef}
							src={DEMO_VIDEO_SRC}
							className='aspect-video w-full rounded-[1.35rem] bg-black'
							controls
							autoPlay
							playsInline
							aria-label='ChainCashier demo video'
						/>
					</div>
				</div>
			) : null}
		</>
	);
}
