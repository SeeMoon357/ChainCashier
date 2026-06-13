'use client';

import { type ReactNode } from 'react';

type GradientButtonProps = {
	children: ReactNode;
	onClick?: () => void;
	type?: 'button' | 'submit';
	disabled?: boolean;
	variant?: 'default' | 'primary';
	className?: string;
};

/**
 * zip 「Get Started」风格渐变胶囊按钮。
 * variant='primary' 用蓝色渐变（主操作，如 Approve & Pay）。
 */
export default function GradientButton({
	children,
	onClick,
	type = 'button',
	disabled,
	variant = 'default',
	className = '',
}: GradientButtonProps) {
	const base =
		'inline-flex items-center justify-center gap-2 rounded-full border border-white/60 font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
	const styles =
		variant === 'primary'
			? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-pill hover:from-blue-400 hover:to-blue-500'
			: 'bg-gradient-to-b from-[#e2e2e2] to-[#c2c6d6] text-gray-800 shadow-pill hover:from-white hover:to-gray-200';
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`${base} ${styles} ${className}`}
		>
			{children}
		</button>
	);
}
