import { encodeFunctionData, erc20Abi } from 'viem';
import { isSupportedCrossChainEarnPair } from './businessChains';

export type ExecutionPreflightResult = {
	ready: boolean;
	reason:
		| null
		| 'blocked_quote_failure'
		| 'blocked_wallet_context'
		| 'blocked_missing_approval_target'
		| 'blocked_insufficient_gas'
		| 'blocked_unsupported_cross_chain_pair';
	requiresApproval: boolean;
	allowanceSufficient: boolean;
	nativeGasSufficient: boolean;
	approvalAddress: string | null;
	amountBaseUnits: bigint | null;
};

type MinimalPreview = {
	fromChain: number;
	toChain: number;
	quote: {
		action?: {
			fromAmount?: string;
			fromToken?: {
				address?: string;
				symbol?: string;
			};
		};
		estimate?: {
			approvalAddress?: string;
			gasCosts?: Array<{
				amount?: string;
				amountUSD?: string;
				token?: { symbol?: string };
			}>;
		};
		transactionRequest?: {
			to?: string;
			data?: string;
		};
	} | null;
};

type WalletExecutionContext = {
	address: string | null;
	chainId: number | null;
	nativeBalance: bigint;
	allowance: bigint;
};

function sumGasAmount(
	gasCosts:
		| Array<{
				amount?: string;
				amountUSD?: string;
				token?: { symbol?: string };
		  }>
		| undefined,
): bigint {
	return (gasCosts ?? []).reduce((sum, cost) => {
		try {
			return sum + BigInt(cost.amount ?? '0');
		} catch {
			return sum;
		}
	}, BigInt(0));
}

export function runExecutionPreflight(input: {
	preview: MinimalPreview;
	wallet: WalletExecutionContext;
}): ExecutionPreflightResult {
	const quote = input.preview.quote;
	const amountBaseUnits = quote?.action?.fromAmount
		? BigInt(quote.action.fromAmount)
		: null;
	const approvalAddress = quote?.estimate?.approvalAddress ?? null;

	if (
		input.preview.fromChain !== input.preview.toChain &&
		!isSupportedCrossChainEarnPair(
			input.preview.fromChain,
			input.preview.toChain,
		)
	) {
		return {
			ready: false,
			reason: 'blocked_unsupported_cross_chain_pair',
			requiresApproval: false,
			allowanceSufficient: false,
			nativeGasSufficient: true,
			approvalAddress,
			amountBaseUnits,
		};
	}

	if (!quote?.transactionRequest?.to || !quote.transactionRequest?.data || !amountBaseUnits) {
		return {
			ready: false,
			reason: 'blocked_quote_failure',
			requiresApproval: false,
			allowanceSufficient: false,
			nativeGasSufficient: true,
			approvalAddress,
			amountBaseUnits,
		};
	}

	if (!input.wallet.address || input.wallet.chainId !== input.preview.fromChain) {
		return {
			ready: false,
			reason: 'blocked_wallet_context',
			requiresApproval: false,
			allowanceSufficient: false,
			nativeGasSufficient: true,
			approvalAddress,
			amountBaseUnits,
		};
	}

	if (!approvalAddress) {
		return {
			ready: false,
			reason: 'blocked_missing_approval_target',
			requiresApproval: false,
			allowanceSufficient: false,
			nativeGasSufficient: true,
			approvalAddress: null,
			amountBaseUnits,
		};
	}

	const estimatedGas = sumGasAmount(quote.estimate?.gasCosts);
	const nativeGasSufficient = input.wallet.nativeBalance >= estimatedGas;
	if (!nativeGasSufficient) {
		return {
			ready: false,
			reason: 'blocked_insufficient_gas',
			requiresApproval: false,
			allowanceSufficient: input.wallet.allowance >= amountBaseUnits,
			nativeGasSufficient: false,
			approvalAddress,
			amountBaseUnits,
		};
	}

	const allowanceSufficient = input.wallet.allowance >= amountBaseUnits;

	return {
		ready: true,
		reason: null,
		requiresApproval: !allowanceSufficient,
		allowanceSufficient,
		nativeGasSufficient: true,
		approvalAddress,
		amountBaseUnits,
	};
}

export function buildApproveRequest(input: {
	tokenAddress: string;
	spender: string;
	amount: bigint;
}) {
	return {
		to: input.tokenAddress,
		value: BigInt(0),
		data: encodeFunctionData({
			abi: erc20Abi,
			functionName: 'approve',
			args: [input.spender as `0x${string}`, input.amount],
		}),
	};
}
