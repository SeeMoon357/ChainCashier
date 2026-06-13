'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * 全局主题切换按钮：左下角浮动，切换整站深/浅色。
 * 依赖 next-themes（Providers 里的 ThemeProvider，attribute='class'）。
 * 用 mounted 守卫避免 SSR 阶段主题未知导致的 hydration 不匹配。
 */
export default function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const timer = window.setTimeout(() => setMounted(true), 0);
		return () => window.clearTimeout(timer);
	}, []);

	const isDark = theme === 'dark';

	return (
		<button
			type='button'
			aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
			title={isDark ? '切换到浅色主题' : '切换到深色主题'}
			onClick={() => setTheme(isDark ? 'light' : 'dark')}
			className='glass-island fixed bottom-8 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full text-gray-600 shadow-glass transition-all hover:scale-105 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
		>
			{mounted ? (
				isDark ? (
					<Sun className='h-5 w-5' />
				) : (
					<Moon className='h-5 w-5' />
				)
			) : (
				// 占位，保持尺寸稳定，避免挂载前后布局跳动
				<span className='block h-5 w-5' />
			)}
		</button>
	);
}
