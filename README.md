# ChainCashier

AI cross-chain checkout agent for PayFi merchants.

ChainCashier lets a merchant create a Base or Arbitrum USDC invoice through a ChatGPT-style agent chat. The generated payment link opens a separate payer chat, where the payer can say which source chain they want to pay from. The agent plans the workflow, requests a LI.FI `quote/toAmount`, validates the quote against the locked invoice, explains costs and safety boundaries, prepares wallet transactions, tracks LI.FI status, and generates a receipt plus support package.

## Hackathon Fit

This project targets the Z.AI Web3 x Long-Horizon Task track.

- GLM-5.1 is the default model for all core agents.
- The product is a multi-step Web3 workflow, not a one-shot chatbot.
- The demo shows task decomposition, streaming reasoning/tool traces, real tool calls, quote validation, wallet confirmation, LI.FI quote/status tracking, controlled repair steps, and final receipt generation.
- The agent never signs or custodies funds. User wallets execute transactions.

## Core Flow

1. Merchant opens `/` and chats: `Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
2. GLM-5.1 parses the request into a locked invoice and streams the reasoning/tool trace.
3. ChainCashier generates an invoice ID and `/pay/[invoiceId]` payment link.
4. Payer opens the payment link in a separate browser, wallet, or account.
5. Payer chats: `I want to pay with USDC on Arbitrum.`
6. The app calls LI.FI `quote/toAmount` so the merchant receives the exact target-chain USDC amount.
7. The chat explains payer estimated cost, fees, slippage boundary, and wallet confirmation.
8. Payer approves USDC if required and submits the LI.FI route transaction.
9. The app saves `sourceTxHash` and polls LI.FI status.
10. When LI.FI reports completion, ChainCashier generates a receipt JSON and support package.

The right-side Agent Run Timeline mirrors the long-horizon task state: parsing, invoice creation, payment link, source selection, LI.FI quote, quote validation, wallet confirmation, status tracking, and receipt generation. It can export a Run Log JSON for hackathon review.

## Tech Stack

- Next.js 16 / React 19 / TypeScript
- RainbowKit + Wagmi + Viem for multi-wallet connection and wallet execution
- Z.AI GLM-5.1 through the OpenAI-compatible API
- LI.FI `quote/toAmount` and `status`
- Local JSON invoice store for local hackathon demo

## Environment

Create `.env.local` in the project root and fill:

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
# Optional overrides. By default, all core ChainCashier agents use zai/glm-5.1.
# MAIN_AGENT_MODEL=zai/glm-5.1
# EARNING_AGENT_MODEL=zai/glm-5.1
# BRIDGE_AGENT_MODEL=zai/glm-5.1
# RISK_AGENT_MODEL=zai/glm-5.1
# MONITOR_AGENT_MODEL=zai/glm-5.1
# CHECKOUT_AGENT_MODEL=zai/glm-5.1

LIFI_API_KEY=

NEXT_PUBLIC_WC_PROJECT_ID=
```

`NEXT_PUBLIC_WC_PROJECT_ID` is required for RainbowKit to show full multi-brand wallet options through WalletConnect. Without it, Wagmi falls back to injected browser wallets.

## Wallet Boundary

Merchant and payer pages use separate Wagmi storage keys:

- Merchant: `chaincashier.merchant.wagmi`
- Payer: `chaincashier.payer.wagmi`

This reduces app-level wallet cache overlap. After the merchant creates an invoice, the payer flow reads the locked merchant address from the invoice, so checkout does not require the merchant wallet to remain connected.

This does not override injected wallet extension behavior. The same Chrome profile and the same MetaMask extension still share global account/disconnect state. For demos, use a separate browser profile, incognito window, Edge, a phone WalletConnect wallet, or another independent wallet environment for the payer.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Script

Use a small real mainnet amount only.

1. Open `/` with the merchant wallet connected.
2. Send: `Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
3. Watch the typed streaming response and the right-side Agent Run Timeline.
4. Copy the generated `/pay/[invoiceId]` link.
5. Open that link in another browser profile, incognito window, phone wallet browser, or independent wallet environment.
6. Connect the payer wallet.
7. Send: `I want to pay with USDC on Arbitrum.`
8. Review the streamed reasoning/tool trace and LI.FI quote card.
9. Click `Approve & Pay With Wallet`.
10. Confirm approval if the wallet asks.
11. Confirm the route transaction.
12. Wait for LI.FI status polling to generate the receipt.
13. Export the Run Log JSON from the right-side timeline for the hackathon submission.

## Safety Boundaries

- Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
- ChainCashier does not custody funds.
- ChainCashier does not hold private keys.
- ChainCashier does not automatically spend user assets.
- Merchant address, target chain, target token, and receive amount are locked in the invoice.
- The payer cannot change merchant receiving terms.
- The quote is blocked if LI.FI target address, target chain, or target token differs from the locked invoice.
- Receipt proof is evidence, not a settlement guarantee.
- When a quote or wallet action fails, the agent records a repair step and asks the user before trying another route.

## Important Files

- `components/ChainCashierChat.tsx`: ChatGPT-style merchant/payer chat UI, typewriter streaming, and the right-side flow recorder.
- `lib/chainCashierStreaming.ts`: splits backend semantic chunks into typewriter tokens for the UI.
- `lib/chainCashier.ts`: invoice model, quote request builder, quote safety validation, receipt/support package logic.
- `lib/chainCashierChat.ts`: chat stream planning helpers and payer source parsing.
- `lib/chainCashierRun.ts`: Agent Run events and exportable Run Log structure.
- `lib/chainCashierChains.ts`: ChainCashier USDC chain configs and supported route matrix.
- `lib/chainCashierStore.ts`: local JSON invoice store for separated merchant/payer sessions.
- `lib/wagmi.config.ts`: RainbowKit/Wagmi wallet configuration with role-scoped storage.
- `lib/agentConfig.ts` and `lib/agentClient.ts`: GLM-5.1 / Z.AI model configuration.
- `lib/lifiClient.ts`: LI.FI quote/status client.
- `app/api/chaincashier/chat/route.ts`: SSE streaming chat endpoint.
- `app/api/payments/quote/route.ts`: LI.FI `quote/toAmount` endpoint wrapper.
- `app/api/payments/status/route.ts`: LI.FI status tracking endpoint.

## Verification

```bash
node --test
npm run lint
npm run build
```
