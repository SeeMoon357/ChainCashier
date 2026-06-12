'use client';

import {
	BulbOutlined,
	CheckCircleOutlined,
	InfoCircleOutlined,
} from '@ant-design/icons';
import { Prompts } from '@ant-design/x';
import type { PromptsProps } from '@ant-design/x';
import { useEffect, useMemo, useState } from 'react';

const promptItems: PromptsProps['items'] = [
	{
		key: '1',
		icon: <BulbOutlined style={{ color: '#FFD700' }} />,
		description: 'Move 1 USDC from Base to Arbitrum with best received amount',
	},
	{
		key: '2',
		icon: <InfoCircleOutlined style={{ color: '#1890FF' }} />,
		description: 'Send 10 USDC from Base to Arbitrum using LI.FI Intents',
	},
	{
		key: '3',
		icon: <CheckCircleOutlined style={{ color: '#52C41A' }} />,
		description: 'Preview a 1 USDC intent order from Base to Arbitrum',
	},
	{
		key: '4',
		icon: <InfoCircleOutlined style={{ color: '#722ED1' }} />,
		description:
			'Transfer 10 USDC from Base to Arbitrum and show me the IntentLens flight recorder',
	},
];

interface PromptProps {
	onItemClick?: (prompt: string) => void;
}

const TYPEWRITER_TEXT = 'Ask IntentLens';

function TypewriterTitle() {
	const [displayText, setDisplayText] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onChange = () => setReduceMotion(media.matches);
		onChange();
		media.addEventListener('change', onChange);

		return () => {
			media.removeEventListener('change', onChange);
		};
	}, []);

	useEffect(() => {
		if (reduceMotion) {
			return;
		}

		const reachedEnd =
			!isDeleting && displayText.length === TYPEWRITER_TEXT.length;
		const reachedStart = isDeleting && displayText.length === 0;

		let timeout = isDeleting ? 70 : 120;
		if (reachedEnd) {
			timeout = 1200;
		} else if (reachedStart) {
			timeout = 280;
		}

		const timer = window.setTimeout(() => {
			if (reachedEnd) {
				setIsDeleting(true);
				return;
			}

			if (reachedStart) {
				setIsDeleting(false);
				return;
			}

			setDisplayText((current) =>
				isDeleting
					? current.slice(0, -1)
					: TYPEWRITER_TEXT.slice(0, current.length + 1),
			);
		}, timeout);

		return () => {
			window.clearTimeout(timer);
		};
	}, [displayText, isDeleting, reduceMotion]);

	const titleText = useMemo(
		() => (reduceMotion ? TYPEWRITER_TEXT : displayText),
		[displayText, reduceMotion],
	);

	return (
		<span
			className='inline-flex items-center'
			style={{
				color: '#000000',
				fontFamily: 'var(--font-art), var(--font-headline), serif',
				fontWeight: 900,
				fontSize: 'clamp(1.55rem, 1.9vw, 2.2rem)',
				letterSpacing: '0.01em',
			}}
		>
			{titleText}
			<span
				aria-hidden
				className='ml-0.5 inline-block h-[1.15em] w-[2px] animate-pulse'
				style={{ backgroundColor: '#000000' }}
			/>
		</span>
	);
}

const Prompt = ({ onItemClick }: PromptProps) => (
	<div className='flex items-center justify-center flex-1'>
		<div className='w-full'>
			<Prompts
				title={<TypewriterTitle />}
				items={promptItems}
				wrap
				onItemClick={({ data }) => {
					if (onItemClick && data?.description) {
						onItemClick(String(data.description));
					}
				}}
			/>
		</div>
	</div>
);

export default Prompt;
