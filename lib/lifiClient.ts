const EARN_API_BASE_URL = 'https://earn.li.fi/v1/earn';
const LIFI_QUOTE_API_BASE_URL = 'https://li.quest/v1/quote';
const LIFI_STATUS_API_BASE_URL = 'https://li.quest/v1/status';

export type LifiClientSuccess<T> = {
	success: true;
	status: number;
	data: T;
};

export type LifiClientFailure = {
	success: false;
	status: number | null;
	error: string;
	payload?: unknown;
};

export type LifiClientResult<T> = LifiClientSuccess<T> | LifiClientFailure;

type FetchLike = typeof fetch;
type QueryParamValue =
	| string
	| number
	| boolean
	| Array<string | number | boolean>
	| undefined
	| null;

function buildSearchParams(
	params: Record<string, QueryParamValue>,
): URLSearchParams {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				searchParams.append(key, String(item));
			}
			continue;
		}

		if (value !== undefined && value !== null) {
			searchParams.set(key, String(value));
		}
	}

	return searchParams;
}

function buildRequestHeaders(init?: RequestInit): HeadersInit | undefined {
	const apiKey = process.env.LIFI_API_KEY?.trim();
	if (!apiKey) {
		return init?.headers;
	}

	return {
		'x-lifi-api-key': apiKey,
		...(init?.headers && typeof init.headers === 'object' ? init.headers : {}),
	};
}

async function parseJsonResponse(response: Response): Promise<unknown> {
	const contentType = response.headers.get('content-type') || '';
	if (!contentType.includes('application/json')) {
		return response.text();
	}

	return response.json();
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
}

async function requestJson<T>(
	fetchImpl: FetchLike,
	url: string,
	init?: RequestInit,
): Promise<LifiClientResult<T>> {
	try {
		const response = await fetchImpl(url, {
			cache: 'no-store',
			...init,
			headers: buildRequestHeaders(init),
		});
		const payload = await parseJsonResponse(response);

		if (!response.ok) {
			return {
				success: false,
				status: response.status,
				error:
					typeof payload === 'string'
						? payload
						: `LI.FI request failed with status ${response.status}.`,
				payload,
			};
		}

		return {
			success: true,
			status: response.status,
			data: payload as T,
		};
	} catch (error) {
		return {
			success: false,
			status: null,
			error: toErrorMessage(error),
		};
	}
}

export function createLifiClient(fetchImpl: FetchLike = fetch) {
	return {
		getVaults(params: Record<string, QueryParamValue>) {
			const searchParams = buildSearchParams(params);
			return requestJson<{ data?: unknown; total?: unknown }>(
				fetchImpl,
				`${EARN_API_BASE_URL}/vaults?${searchParams.toString()}`,
			);
		},
		getVaultByChainAndAddress(input: { chainId: number; address: string }) {
			return requestJson<unknown>(
				fetchImpl,
				`${EARN_API_BASE_URL}/vaults/${input.chainId}/${input.address}`,
			);
		},
		getChains() {
			return requestJson<unknown[]>(fetchImpl, `${EARN_API_BASE_URL}/chains`);
		},
		getProtocols() {
			return requestJson<unknown[]>(fetchImpl, `${EARN_API_BASE_URL}/protocols`);
		},
		getPortfolioPositions(input: { userAddress: string }) {
			return requestJson<{ positions?: unknown }>(
				fetchImpl,
				`${EARN_API_BASE_URL}/portfolio/${input.userAddress}/positions`,
			);
		},
		getQuote(params: Record<string, QueryParamValue>) {
			const searchParams = buildSearchParams(params);
			return requestJson<Record<string, unknown>>(
				fetchImpl,
				`${LIFI_QUOTE_API_BASE_URL}?${searchParams.toString()}`,
			);
		},
		getStatus(params: Record<string, QueryParamValue>) {
			const searchParams = buildSearchParams(params);
			return requestJson<Record<string, unknown>>(
				fetchImpl,
				`${LIFI_STATUS_API_BASE_URL}?${searchParams.toString()}`,
			);
		},
	};
}
