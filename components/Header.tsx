'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import questionIcon from '@/app/question.png';
import { WalletButton } from './WalletConnect';

export default function Header() {
	const { theme, resolvedTheme, setTheme } = useTheme();

	const currentTheme = theme === 'system' ? resolvedTheme : theme;

	// 主题切换函数
	const toggleTheme = () => {
		setTheme(currentTheme === 'dark' ? 'light' : 'dark');
	};

	useEffect(() => {
		if (currentTheme !== 'light' && currentTheme !== 'dark') return;

		document.cookie = `theme=${currentTheme}; path=/; max-age=31536000`;
		const metaThemeColor = document.querySelector('meta[name="theme-color"]');
		if (metaThemeColor) {
			metaThemeColor.setAttribute(
				'content',
				currentTheme === 'dark' ? '#212121' : '#ffffff',
			);
		}
	}, [currentTheme]);

	return (
		<header className='flex items-center justify-between px-4 h-14 sticky top-0 z-10 [background:var(--app-panel)]'>
			<div className='ml-auto flex items-center gap-3'>
				{/* Theme Toggle */}
				<button
					onClick={toggleTheme}
					className='cursor-pointer w-9 h-9 rounded-full border-none outline-none ring-0 hover:bg-[var(--app-hover)] [color:var(--app-muted)] transition-colors'
				>
					<span className='theme-icon-moon'>🌙</span>
					<span className='theme-icon-sun'>☀️</span>
				</button>

				{/* User Actions */}
				<button
					aria-label='Help'
					className='cursor-pointer w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--app-hover)] [color:var(--app-muted)] transition-colors'
				>
					<Image
						src={questionIcon}
						alt='Help'
						width={18}
						height={18}
						className='theme-adaptive-icon'
					/>
				</button>

				{/* Sign Up/in */}
				<WalletButton />
			</div>
		</header>
	);
}
