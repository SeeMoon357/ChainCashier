# ChainCashier

AI cross-chain checkout agent for PayFi merchants.

ChainCashier lets a merchant create a Base USDC invoice in natural language. A payer can pay from another supported chain, while the agent plans the workflow, requests a LI.FI `quote/toAmount`, explains costs and safety boundaries, prepares wallet transactions, tracks LI.FI status, and generates a receipt plus support package.

## Hackathon Fit

This project targets the Z.AI Web3 x Long-Horizon Task track.

- GLM-5.1 drives the checkout planning agent.
- The product is a multi-step Web3 workflow, not a one-shot chatbot.
- The demo shows task decomposition, tool calls, wallet confirmation, LI.FI quote/status tracking, and final receipt generation.
- The agent never signs or custodies funds. User wallets execute transactions.

## Core Flow

1. Merchant asks: `Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
2. GLM-5.1 parses the request into a locked invoice.
3. ChainCashier generates an invoice ID and `/pay/[invoiceId]` payment link.
4. Payer chooses a source asset such as Arbitrum USDC.
5. The app calls LI.FI `quote/toAmount` so the merchant receives the exact Base USDC amount.
6. The UI explains payer estimated cost, fees, slippage boundary, and wallet confirmation.
7. Payer approves USDC if required and submits the LI.FI route transaction.
8. The app saves `sourceTxHash` and polls LI.FI status.
9. When LI.FI reports completion, ChainCashier generates a receipt JSON and support package.

## Tech Stack

- Next.js 16 / React 19 / TypeScript
- RainbowKit + Wagmi + Viem for multi-wallet connection and wallet execution
- Z.AI GLM-5.1 through an OpenAI-compatible provider
- LI.FI `quote/toAmount` and `status`
- In-memory invoice store for local hackathon demo

## Environment

Copy `.env.local.example` to `.env.local` and fill:

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
CHECKOUT_AGENT_MODEL=zai/glm-5.1

LIFI_API_KEY=

NEXT_PUBLIC_WC_PROJECT_ID=
```

`NEXT_PUBLIC_WC_PROJECT_ID` is required for RainbowKit to show full multi-brand wallet options through WalletConnect. Without it, Wagmi falls back to injected browser wallets.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Script

Use a small real mainnet amount only.

1. Connect a merchant wallet or paste a merchant address.
2. Create an invoice for `20 USDC on Base`.
3. Connect the payer wallet.
4. Select `Arbitrum USDC` as the payer source asset.
5. Request a LI.FI quote.
6. Review payer estimated cost and merchant locked receiving terms.
7. Click `Approve & Pay With Wallet`.
8. Confirm approval if the wallet asks.
9. Confirm the route transaction.
10. Wait for LI.FI status polling to generate the receipt.

## Safety Boundaries

- Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
- ChainCashier does not custody funds.
- ChainCashier does not hold private keys.
- ChainCashier does not automatically spend user assets.
- Merchant address, target chain, target token, and receive amount are locked in the invoice.
- The payer cannot change merchant receiving terms.
- The quote is blocked if LI.FI target address, target chain, or target token differs from the locked invoice.
- Receipt proof is evidence, not a settlement guarantee.

## Important Files

- `components/ChainCashierDemo.tsx`: main merchant/payer/recorder demo UI.
- `lib/chainCashier.ts`: invoice model, quote request builder, quote safety validation, receipt/support package logic.
- `lib/agentConfig.ts` and `lib/agentClient.ts`: GLM-5.1 / Z.AI model configuration.
- `lib/lifiClient.ts`: LI.FI quote/status client.
- `app/api/chaincashier/agent/route.ts`: GLM-5.1 checkout planning endpoint.
- `app/api/payments/quote/route.ts`: LI.FI `quote/toAmount` endpoint wrapper.
- `app/api/payments/status/route.ts`: LI.FI status tracking endpoint.

## Verification

```bash
node tests/chain-cashier.test.mjs
node tests/agent-config.test.mjs
node tests/agent-client.test.mjs
node tests/lifi-client.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

