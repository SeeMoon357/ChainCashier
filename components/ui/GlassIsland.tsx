import { type ReactNode } from 'react';

/**
 * 毛玻璃岛屿容器，作导航条 / 卡片 / 输入框外壳的统一基底。
 * 样式来自 globals.css 的 `.glass-island` 工具类。
 */
export default function GlassIsland({
	children,
	className = '',
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={`glass-island ${className}`}>{children}</div>;
}
