'use client';

import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { getChainLabel } from '@/lib/businessChains';
import type { IntentFlightRecord, IntentFlightStep } from '@/lib/lifiIntents';

type IntentFlightRecordCardProps = {
	record?: IntentFlightRecord;
	onOpenClassicRoute?: () => void;
};

function statusIcon(status: IntentFlightStep['status']) {
	if (status === 'completed') {
		return <CheckCircle2 className='h-4 w-4 text-emerald-600' />;
	}

	if (status === 'failed') {
		return <XCircle className='h-4 w-4 text-rose-600' />;
	}

	return <CircleDashed className='h-4 w-4 text-slate-400' />;
}

function formatJson(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

export default function IntentFlightRecordCard({
	record,
	onOpenClassicRoute,
}: IntentFlightRecordCardProps) {
	if (!record) {
		return null;
	}

	const fromChain = getChainLabel(record.goal.sourceChain);
	const toChain = getChainLabel(record.goal.targetChain);
	const quoteReady = record.status === 'quote_ready';

	return (
		<div className='intentlens-card-strong mt-3 rounded-[22px] p-4 text-sm'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<div className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
						IntentLens Flight Recorder
					</div>
					<div className='mt-1 text-base font-semibold text-slate-950'>
						{record.goal.amount ?? 'Unknown amount'} {record.goal.asset}: {fromChain} {'->'} {toChain}
					</div>
				</div>
				<div
					className={`rounded-full px-3 py-1 text-xs font-semibold ${
						quoteReady
							? 'intentlens-status-pill'
							: 'bg-amber-50 text-amber-700'
					}`}
				>
					{quoteReady ? 'Mainnet quote ready' : 'Quote unavailable'}
				</div>
			</div>

			<div className='mt-4 grid gap-2'>
				{record.steps.map((step) => (
					<div
						key={step.key}
						className='intentlens-step-card grid grid-cols-[auto_1fr] gap-3 rounded-2xl px-3 py-2.5'
					>
						<div className='pt-0.5'>{statusIcon(step.status)}</div>
						<div>
							<div className='font-medium text-slate-950'>{step.title}</div>
							<div className='mt-1 text-xs leading-5 text-slate-600'>
								{step.summary}
							</div>
						</div>
					</div>
				))}
			</div>

			<div className='intentlens-soft-panel mt-4 rounded-2xl px-3 py-3 text-slate-700'>
				<div className='font-medium text-slate-950'>What happened in this run</div>
				<p className='mt-1 text-xs leading-5'>{record.educationSummary}</p>
			</div>

			<details className='mt-3 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2'>
				<summary className='cursor-pointer text-xs font-semibold text-slate-700'>
					Compared with classic LI.FI route flow
				</summary>
				<p className='mt-2 text-xs leading-5 text-slate-600'>
					{record.classicRouteComparison}
				</p>
				{record.classicRoutePrompt && onOpenClassicRoute ? (
					<button
						type='button'
						className='mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50'
						onClick={onOpenClassicRoute}
					>
						Open classic route preview
					</button>
				) : null}
			</details>

			<details className='mt-3 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2'>
				<summary className='cursor-pointer text-xs font-semibold text-slate-700'>
					Quote / order preview payload
				</summary>
				<pre className='mt-2 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100'>
					{formatJson(record.orderPreview ?? record.quoteResult)}
				</pre>
			</details>

			<div className='mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/75 px-3 py-2 text-xs leading-5 text-amber-900'>
				Mainnet safety: IntentLens never signs or spends automatically. Funds move only if you manually confirm a wallet signature.
			</div>
		</div>
	);
}
