const ORDER_API_BASE_URL = 'https://order.li.fi';
const INPUT_SETTLER_ESCROW_ADDRESS =
	'0x000025c3226C00B2Cdc200005a1600509f4e00C0';
const ARBITRUM_TX_BASE_URL = 'https://arbiscan.io/tx/';

export type LifiIntentOrderStatus =
	| 'Signed'
	| 'Delivered'
	| 'Settled'
	| 'Refunded'
	| 'Expired'
	| 'Unknown';

export type NormalizedLifiIntentStatus = {
	orderId: string | null;
	orderIdentifier: string | null;
	orderStatus: LifiIntentOrderStatus;
	deliveredAt: string | null;
	settledAt: string | null;
	deliveredTxHash: string | null;
	settledTxHash: string | null;
	deliveryExplorerLink: string | null;
};

type ReceiptLogLike = {
	address?: string;
	topics?: readonly string[];
};

type LifiIntentStatusPayload = {
	meta?: {
		orderStatus?: string | null;
		orderIdentifier?: string | null;
		onChainOrderId?: string | null;
		orderDeliveredTxHash?: string | null;
		orderSettledTxHash?: string | null;
		deliveredAt?: string | null;
		settledAt?: string | null;
	};
};

function normalizeStatus(status: unknown): LifiIntentOrderStatus {
	if (
		status === 'Signed' ||
		status === 'Delivered' ||
		status === 'Settled' ||
		status === 'Refunded' ||
		status === 'Expired'
	) {
		return status;
	}

	return 'Unknown';
}

function isHex32(value: string | undefined): value is string {
	return /^0x[0-9a-fA-F]{64}$/.test(value ?? '');
}

export function extractIntentOrderIdFromLogs(
	logs: readonly ReceiptLogLike[],
): string | null {
	const escrowAddress = INPUT_SETTLER_ESCROW_ADDRESS.toLowerCase();
	const openLog = logs.find(
		(log) =>
			log.address?.toLowerCase() === escrowAddress &&
			isHex32(log.topics?.[1]),
	);

	return openLog?.topics?.[1] ?? null;
}

export function buildArbitrumTxLink(hash: string | null | undefined): string | null {
	return hash ? `${ARBITRUM_TX_BASE_URL}${hash}` : null;
}

export function normalizeLifiIntentOrderStatus(
	payload: LifiIntentStatusPayload,
): NormalizedLifiIntentStatus {
	const meta = payload.meta ?? {};
	const deliveredTxHash = meta.orderDeliveredTxHash ?? null;
	const settledTxHash = meta.orderSettledTxHash ?? null;

	return {
		orderId: meta.onChainOrderId ?? null,
		orderIdentifier: meta.orderIdentifier ?? null,
		orderStatus: normalizeStatus(meta.orderStatus),
		deliveredAt: meta.deliveredAt ?? null,
		settledAt: meta.settledAt ?? null,
		deliveredTxHash,
		settledTxHash,
		deliveryExplorerLink: buildArbitrumTxLink(deliveredTxHash),
	};
}

export async function fetchLifiIntentOrderStatus(
	orderId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<NormalizedLifiIntentStatus> {
	const url = `${ORDER_API_BASE_URL}/orders/status?onChainOrderId=${encodeURIComponent(orderId)}`;
	const response = await fetchImpl(url, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`LI.FI Intents status request failed with status ${response.status}.`);
	}

	const payload = (await response.json()) as LifiIntentStatusPayload;
	return normalizeLifiIntentOrderStatus(payload);
}
