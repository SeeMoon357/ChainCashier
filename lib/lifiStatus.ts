import { getChainLabel } from './businessChains';

export type LifiStatusResponse = {
	transactionId?: string;
	status?: string;
	substatus?: string;
	substatusMessage?: string;
	sending?: {
		txHash?: string;
		chainId?: number;
	};
	receiving?: {
		txHash?: string;
		chainId?: number;
		token?: {
			symbol?: string;
		};
	};
	tool?: string;
};

export type LifiRouteStatus =
	| 'pending'
	| 'completed'
	| 'partial'
	| 'refunded'
	| 'failed';

export type ResolvedLifiRouteStatus = {
	clientStatus: 'tracking_route' | 'confirmed' | 'failed';
	routeStatus: LifiRouteStatus;
	substatus: string | null;
	message: string;
	receivingTxHash: string | null;
	receivingChainId: number | null;
	receivingTokenSymbol: string | null;
};

function describeReceivingTarget(input: {
	chainId: number | null;
	tokenSymbol: string | null;
}): string {
	const chainLabel =
		typeof input.chainId === 'number'
			? getChainLabel(input.chainId)
			: 'the reported chain';

	if (input.tokenSymbol) {
		return `${input.tokenSymbol} on ${chainLabel}`;
	}

	return chainLabel;
}

export function resolveLifiRouteStatus(
	response: LifiStatusResponse | null | undefined,
): ResolvedLifiRouteStatus {
	const normalizedStatus = response?.status?.toUpperCase() ?? '';
	const normalizedSubstatus = response?.substatus?.toUpperCase() ?? null;
	const receivingChainId =
		typeof response?.receiving?.chainId === 'number'
			? response.receiving.chainId
			: null;
	const receivingTokenSymbol = response?.receiving?.token?.symbol ?? null;
	const receivingTxHash = response?.receiving?.txHash ?? null;
	const receivingTarget = describeReceivingTarget({
		chainId: receivingChainId,
		tokenSymbol: receivingTokenSymbol,
	});

	if (normalizedStatus === 'DONE' && normalizedSubstatus === 'COMPLETED') {
		return {
			clientStatus: 'confirmed',
			routeStatus: 'completed',
			substatus: normalizedSubstatus,
			message: `Cross-chain route completed on ${receivingTarget}.`,
			receivingTxHash,
			receivingChainId,
			receivingTokenSymbol,
		};
	}

	if (normalizedStatus === 'DONE' && normalizedSubstatus === 'PARTIAL') {
		return {
			clientStatus: 'confirmed',
			routeStatus: 'partial',
			substatus: normalizedSubstatus,
			message: `Cross-chain route completed with a different received asset: ${receivingTarget}.`,
			receivingTxHash,
			receivingChainId,
			receivingTokenSymbol,
		};
	}

	if (normalizedStatus === 'DONE' && normalizedSubstatus === 'REFUNDED') {
		const refundSummary = `Cross-chain route failed and was refunded to ${receivingTarget}.`;
		return {
			clientStatus: 'failed',
			routeStatus: 'refunded',
			substatus: normalizedSubstatus,
			message:
				response?.substatusMessage?.trim()
					? `${response.substatusMessage.trim()} ${refundSummary}`
					: refundSummary,
			receivingTxHash,
			receivingChainId,
			receivingTokenSymbol,
		};
	}

	if (normalizedStatus === 'FAILED') {
		return {
			clientStatus: 'failed',
			routeStatus: 'failed',
			substatus: normalizedSubstatus,
			message:
				response?.substatusMessage?.trim() ||
				'Cross-chain route failed before reaching the destination chain.',
			receivingTxHash,
			receivingChainId,
			receivingTokenSymbol,
		};
	}

	return {
		clientStatus: 'tracking_route',
		routeStatus: 'pending',
		substatus: normalizedSubstatus,
		message: 'Source-chain route confirmed. Tracking final LI.FI route status.',
		receivingTxHash,
		receivingChainId,
		receivingTokenSymbol,
	};
}
