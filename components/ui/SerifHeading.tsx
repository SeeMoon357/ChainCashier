import { type ReactNode } from 'react';

type SerifHeadingProps = {
	children: ReactNode;
	className?: string;
	as?: 'h1' | 'h2' | 'h3';
};

/**
 * Source Serif 4 衬线大标题，用于首屏 / 空状态等强调位置。
 * 字体来自 globals.css 的 `.font-serif-display` 工具类。
 */
export default function SerifHeading({
	children,
	className = '',
	as: Tag = 'h2',
}: SerifHeadingProps) {
	return (
		<Tag className={`font-serif-display tracking-tight text-[#1a1c1c] ${className}`}>
			{children}
		</Tag>
	);
}
