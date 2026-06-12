'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import HomeMainContent from '@/components/home/HomeMainContent';
import HomeShell, { type HomeViewId } from '@/components/home/HomeShell';

export default function Home() {
	const [currentView, setCurrentView] = useState<HomeViewId>('auto-agent');
	const { theme, resolvedTheme, setTheme } = useTheme();

	const currentTheme = theme === 'system' ? resolvedTheme : theme;

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
		<HomeShell
			currentView={currentView}
			onViewChange={setCurrentView}
			onToggleTheme={toggleTheme}
		>
			<HomeMainContent currentView={currentView} />
		</HomeShell>
	);
}
