'use client';

import { Button } from 'antd';
import { getChainLabel } from '@/lib/businessChains';
import type { ExecutionPreview } from '@/lib/executionRuntime';
import type { NormalizedVaultCandidate } from '@/lib/lifiRuntime';
import type { PlannerOutput } from '@/lib/plannerRuntime';
import type { ClientExecutionState } from '@/lib/executionClient';

function renderExecutionStatus(
	executionState: ClientExecutionState,
	preview?: ExecutionPreview,
) {
	const { status, routeStatus } = executionState;
	const isCrossChain = preview?.executionKind === 'cross_chain';
	const isIntentEscrow = preview?.quote?.tool === 'lifi-intents';

	switch (status) {
		case 'preflighting':
			return 'Checking wallet, gas, and allowance';
		case 'awaiting_wallet_approval':
			return 'Awaiting wallet approval signature';
		case 'approving':
			return 'Approval transaction submitted';
		case 'approved':
			return 'Approval confirmed';
		case 'awaiting_wallet_execution':
			if (isIntentEscrow) {
				return 'Awaiting LI.FI Intents escrow signature';
			}
			return isCrossChain
				? 'Awaiting bridge route signature'
				: 'Awaiting deposit signature';
		case 'submitting':
			if (isIntentEscrow) {
				return 'Intent escrow transaction signed, waiting for Base confirmation';
			}
			return isCrossChain
				? 'Route signed, waiting for source-chain confirmation'
				: 'Deposit signed, waiting for on-chain confirmation';
		case 'submitted':
			return isCrossChain ? 'Route transaction submitted' : 'Deposit transaction submitted';
		case 'tracking_route':
			return 'Source-chain route confirmed, tracking final LI.FI status';
		case 'confirmed':
			if (isIntentEscrow) {
				if (executionState.intentOrderStatus === 'Settled') {
					return 'Intent settled';
				}
				if (
					executionState.intentOrderStatus === 'Delivered' ||
					executionState.routeReceivingTxHash
				) {
					return 'Solver delivered on Arbitrum';
				}
				return 'Intent opened on Base; waiting for solver delivery';
			}
			if (isCrossChain && routeStatus === 'partial') {
				return 'Route completed with alternate asset';
			}
			return isCrossChain
				? 'Cross-chain route completed'
				: 'Deposit confirmed on chain';
		case 'failed':
			if (routeStatus === 'refunded') {
				return 'Route failed and was refunded';
			}
			return 'Execution failed';
		case 'idle':
		default:
			return 'Idle';
	}
}

function deliveryStatusLabel(status: ClientExecutionState['intentOrderStatus']) {
	if (status === 'Settled') return 'Settled';
	if (status === 'Delivered') return 'Delivered';
	if (status === 'Refunded') return 'Refunded';
	if (status === 'Expired') return 'Expired';
	if (status === 'Signed') return 'Waiting for solver delivery';
	return 'Waiting for status';
}

type ExecutionPreviewCardProps = {
	plan?: PlannerOutput;
	preview?: ExecutionPreview;
	selectedVault?: NormalizedVaultCandidate | null;
	alternatives?: NormalizedVaultCandidate[];
	executionState?: ClientExecutionState;
	onExecute?: () => void;
};

export default function ExecutionPreviewCard({
	plan,
	preview,
	selectedVault,
	alternatives = [],
	executionState,
	onExecute,
}: ExecutionPreviewCardProps) {
	if (!preview) {
		return null;
	}
	const isIntentEscrow = preview.quote?.tool === 'lifi-intents';

	return (
		<div className='intentlens-card mt-3 rounded-[22px] p-4 text-sm'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div className='font-semibold text-slate-950'>
					{isIntentEscrow ? 'LI.FI Intents Escrow Preview' : 'Execution Preview'}
				</div>
				<div className='rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600'>
					{preview.routeSource === 'live' ? 'Live quote' : 'Fallback quote'}
				</div>
			</div>
			<div className='mt-3 grid gap-2 text-slate-700'>
				<div>
					{isIntentEscrow ? 'Intent action' : 'Selected vault'}: {preview.targetVault}
				</div>
				<div>
					Protocol: {isIntentEscrow ? 'LI.FI Intents' : selectedVault?.protocolName ?? 'Unknown'}
				</div>
				<div>Execution kind: {preview.executionKind}</div>
				<div>
					Route: {getChainLabel(preview.fromChain)} {'->'}{' '}
					{getChainLabel(preview.toChain)}
				</div>
				<div>Destination chain: {preview.destinationChainLabel}</div>
				<div>Bridge required: {preview.bridgeRequired ? 'yes' : 'no'}</div>
				{preview.executionKind === 'cross_chain' && preview.toChain === 137 ? (
					<div className='rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-sky-900'>
						This version does not include destination-chain gas refueling. You may still need POL for manual transactions on Polygon later.
					</div>
				) : null}
				<div>
					Amount: {preview.fromAmount ? `${preview.fromAmount} ${preview.fromToken}` : 'Not provided'}
				</div>
				<div>Fees: {preview.fees}</div>
				<div>Route source: {preview.routeSource}</div>
				<div>
					Approval target:{' '}
					{preview.approvalAddress ? preview.approvalAddress : 'Unavailable'}
				</div>
				<div>
					Estimated gas:{' '}
					{preview.estimatedGasUsd ?? 'n/a'}
					{preview.estimatedGasNative ? ` (${preview.estimatedGasNative})` : ''}
				</div>
				<div>
					Duration:{' '}
					{preview.executionDurationSeconds == null
						? 'n/a'
						: `${preview.executionDurationSeconds}s`}
				</div>
				<div>
					Approval path:{' '}
					{executionState?.preflight
						? executionState.preflight.requiresApproval
							? isIntentEscrow
								? 'Approval required before opening the escrow order'
								: preview.executionKind === 'cross_chain'
								? 'Approval required before the route transaction'
								: 'Approval required before deposit'
							: 'Allowance already sufficient'
						: preview.requiresApproval
							? isIntentEscrow
								? 'Allowance check required before opening the escrow order'
								: preview.executionKind === 'cross_chain'
								? 'Allowance check required before the route transaction'
								: 'Allowance check required before deposit'
							: 'No approval expected'}
				</div>
				<div>
					Tracking scope:{' '}
					{preview.statusTrackingScope === 'source_tx_only'
						? 'Source chain transaction only'
						: 'Full route'}
				</div>
				{executionState?.routeStatus ? (
					<div>Final route outcome: {executionState.routeStatus}</div>
				) : null}
				{executionState?.routeReceivingTokenSymbol || executionState?.routeReceivingChainId ? (
					<div>
						Actual LI.FI result:{' '}
						{executionState.routeReceivingTokenSymbol
							? `${executionState.routeReceivingTokenSymbol} on `
							: ''}
						{executionState.routeReceivingChainId != null
							? getChainLabel(executionState.routeReceivingChainId)
							: 'reported destination'}
					</div>
				) : null}
				{preview.routeStepsSummary.length > 0 ? (
					<div>
						Route steps: {preview.routeStepsSummary.join(' | ')}
					</div>
				) : null}
				{plan?.minApy != null ? <div>Target APY: {plan.minApy}%+</div> : null}
				{alternatives.length > 0 ? (
					<div>
						Alternatives:{' '}
						{alternatives
							.map((vault) => `${vault.name} (${vault.apyTotal.toFixed(2)}%)`)
							.join(', ')}
					</div>
				) : null}
				{preview.blockingReason ? (
					<div className='rounded-2xl border border-amber-300/80 bg-amber-50/80 px-3 py-2 text-amber-900'>
						{preview.blockingReason}
					</div>
				) : null}
				{executionState?.routeStatus === 'partial' && executionState.routeMessage ? (
					<div className='rounded-2xl border border-amber-300/80 bg-amber-50/80 px-3 py-2 text-amber-900'>
						{executionState.routeMessage}
					</div>
				) : null}
				{executionState?.error ? (
					<div className='rounded-2xl border border-rose-300/80 bg-rose-50/80 px-3 py-2 text-rose-900'>
						{executionState.routeStatus === 'refunded' && executionState.routeMessage
							? executionState.routeMessage
							: executionState.error}
					</div>
				) : null}
				{executionState?.status === 'tracking_route' && executionState.routeMessage ? (
					<div className='rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-sky-900'>
						{executionState.routeMessage}
					</div>
				) : null}
				{isIntentEscrow && executionState?.executionTxHash ? (
					<div className='rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-emerald-950'>
						<div className='font-semibold'>Delivery Tracker</div>
						<div className='mt-1'>Opened on Base: done</div>
						<div>
							Solver delivery:{' '}
							{executionState.routeReceivingTxHash
								? 'delivered'
								: deliveryStatusLabel(executionState.intentOrderStatus)}
						</div>
						<div>
							Settlement:{' '}
							{executionState.intentOrderStatus === 'Settled' ||
							executionState.intentSettledAt
								? 'settled'
								: 'waiting'}
						</div>
						{executionState.intentOrderId ? (
							<div className='mt-1 break-all text-xs'>
								Order ID: {executionState.intentOrderId}
							</div>
						) : null}
						{executionState.routeMessage ? (
							<div className='mt-1 text-xs'>{executionState.routeMessage}</div>
						) : null}
						{executionState.intentStatusError ? (
							<div className='mt-1 text-xs text-amber-800'>
								{executionState.intentStatusError}
							</div>
						) : null}
					</div>
				) : null}
				{executionState?.preflight ? (
					<div className='intentlens-soft-panel rounded-2xl px-3 py-2 text-slate-600'>
						<div>Allowance sufficient: {executionState.preflight.allowanceSufficient ? 'yes' : 'no'}</div>
						<div>Native gas sufficient: {executionState.preflight.nativeGasSufficient ? 'yes' : 'no'}</div>
					</div>
				) : null}
			</div>

			<div className='mt-4 flex flex-wrap items-center gap-3'>
				<Button
					type='primary'
					onClick={onExecute}
					disabled={
						!preview.canExecute ||
						executionState?.status === 'tracking_route' ||
						executionState?.status === 'confirmed'
					}
					loading={
						executionState?.status === 'preflighting' ||
						executionState?.status === 'awaiting_wallet_approval' ||
						executionState?.status === 'approving' ||
						executionState?.status === 'awaiting_wallet_execution' ||
						executionState?.status === 'submitting' ||
						executionState?.status === 'submitted' ||
						executionState?.status === 'tracking_route'
					}
				>
					{isIntentEscrow ? 'Open Intent With Wallet' : 'Execute With Wallet'}
				</Button>
				{executionState ? (
					<span>Status: {renderExecutionStatus(executionState, preview)}</span>
				) : null}
			</div>

			{executionState?.approvalTxHash ? (
				<div className='mt-3 text-xs'>
					<a
						href={executionState.explorerLinks[0]}
						target='_blank'
						rel='noreferrer'
						className='text-blue-700 underline'
					>
						Approval tx: {executionState.approvalTxHash}
					</a>
				</div>
			) : null}

			{executionState?.executionTxHash ? (
				<div className='mt-2 text-xs'>
					<a
						href={executionState.explorerLinks[executionState.approvalTxHash ? 1 : 0]}
						target='_blank'
						rel='noreferrer'
						className='text-blue-700 underline'
					>
						{isIntentEscrow
							? 'Intent open tx'
							: preview.executionKind === 'cross_chain'
								? 'Route tx'
								: 'Deposit tx'}:{' '}
						{executionState.executionTxHash}
					</a>
				</div>
			) : null}

			{executionState?.routeReceivingTxHash && executionState.routeReceivingExplorerLink ? (
				<div className='mt-2 text-xs'>
					<a
						href={executionState.routeReceivingExplorerLink}
						target='_blank'
						rel='noreferrer'
						className='text-blue-700 underline'
					>
						{isIntentEscrow ? 'Arbitrum delivery tx' : 'Receiving tx'}:{' '}
						{executionState.routeReceivingTxHash}
					</a>
				</div>
			) : null}

			{!executionState?.approvalTxHash && !executionState?.executionTxHash && executionState?.txHashes?.length ? (
				<div className='mt-3 grid gap-1'>
					{executionState.txHashes.map((hash, index) => (
						<a
							key={hash}
							href={executionState.explorerLinks[index]}
							target='_blank'
							rel='noreferrer'
							className='text-xs text-blue-700 underline'
						>
							{hash}
						</a>
					))}
				</div>
			) : null}
		</div>
	);
}
