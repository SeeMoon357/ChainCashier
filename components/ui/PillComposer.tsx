'use client';

import { type FormEvent, useState } from 'react';
import { Mic, Send, Square } from 'lucide-react';

type PillComposerProps = {
	value: string;
	onChangeAction: (value: string) => void;
	onSubmitAction: (value: string) => void;
	loading?: boolean;
	onCancelAction?: () => void;
	placeholder?: string;
};

/**
 * zip ChatPage 同款底部浮动胶囊输入框。
 * 对接 ChainCashierChat / ChatContent 现有的 sender props，可直接替换。
 * loading 时发送按钮切换为停止按钮，点击触发 onCancelAction。
 */
export default function PillComposer({
	value,
	onChangeAction,
	onSubmitAction,
	loading = false,
	onCancelAction,
	placeholder = 'Type your request here...',
}: PillComposerProps) {
	const [focused, setFocused] = useState(false);

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (loading) {
			onCancelAction?.();
			return;
		}
		const text = value.trim();
		if (!text) return;
		onSubmitAction(text);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={`glass-island flex items-center rounded-full border border-white/90 bg-white/80 px-2 py-1.5 transition-all ${
				focused ? 'shadow-ambient ring-4 ring-blue-500/10' : 'shadow-glass'
			}`}
		>
			<button
				type='button'
				aria-label='voice input'
				className='shrink-0 p-3 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
			>
				<Mic className='h-[1.125rem] w-[1.125rem]' />
			</button>
			<input
				type='text'
				value={value}
				onChange={(event) => onChangeAction(event.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				placeholder={placeholder}
				className='flex-1 border-none bg-transparent px-3 text-base font-medium text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500'
			/>
			<button
				type='submit'
				aria-label={loading ? 'stop' : 'send'}
				className={`shrink-0 p-3 transition-colors ${
					loading
						? 'text-rose-500 hover:text-rose-600'
						: value.trim()
							? 'text-blue-500 hover:text-blue-600'
							: 'text-gray-400'
				}`}
			>
				{loading ? (
					<Square className='h-[1.125rem] w-[1.125rem] fill-current' />
				) : (
					<Send className='h-[1.125rem] w-[1.125rem]' />
				)}
			</button>
		</form>
	);
}
