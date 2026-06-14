<p align="right">
  English | <a href="./README.zh-CN.md">中文</a>
</p>

# ChainCashier

GLM-5.1 powered long-horizon cross-chain checkout agent for Web3 and PayFi merchants.

- **Live Demo**: [chaincashier.vercel.app](https://chaincashier.vercel.app/)
- **Pitch Deck**: [chaincashier.vercel.app/pitch](https://chaincashier.vercel.app/pitch)
- **Demo Video**: available on the home page
- **Track**: Z.AI Web3 x Long-Horizon Task

## Overview

ChainCashier lets a merchant create a locked USDC invoice through chat. The payer opens an independent checkout chat, chooses a supported source chain, confirms the transaction with their own wallet, and the merchant receives the target amount on Base or Arbitrum.

The agent plans the workflow, calls LI.FI quote and status tools, validates every route against the locked invoice, explains fees and safety boundaries, tracks the payment state, and generates a verifiable receipt package.

## Hackathon Fit

ChainCashier is designed for the Z.AI Web3 x Long-Horizon Task track:

- **GLM-5.1 as the agent brain**: core merchant and payer decisions are driven by GLM-5.1 through the Z.AI OpenAI-compatible API.
- **Long-horizon workflow**: the demo is not a one-shot API call. It covers intent parsing, invoice creation, payment link delivery, source-chain selection, LI.FI quoting, quote validation, wallet confirmation, status polling, receipt generation, and Run Log export.
- **Tool use and iteration**: the agent calls real payment tools, records every step in the Agent Run Timeline, and asks the user to adjust when a route, wallet action, or status check fails.
- **Web3 proof**: successful runs produce transaction hashes, explorer links, LI.FI status evidence, receipt JSON, and an exportable support package.
- **Safety boundary**: the agent never signs, never stores private keys, and never custodies funds. The user wallet is always the executor.

## Core Workflow

1. The merchant opens `/` or `/chat` and describes the invoice.
2. GLM-5.1 parses the request into amount, settlement chain, token, purpose, and fee policy.
3. ChainCashier locks the merchant address, target chain, target token, and target amount into an invoice.
4. The app generates a `/pay/[invoiceId]` checkout link.
5. The payer opens the link in a separate browser, wallet profile, or WalletConnect wallet.
6. The payer chooses a source chain in chat.
7. The app calls LI.FI `quote/toAmount` so the merchant receives the exact target-chain amount.
8. ChainCashier validates the quote target address, chain, token, and amount against the locked invoice.
9. The payer confirms approval and payment in their wallet.
10. The app stores `sourceTxHash`, polls LI.FI status, and records the timeline.
11. When the route completes, ChainCashier generates a receipt and support package.

## Supported Routes

Merchant settlement targets:

```text
Base USDC
Arbitrum USDC
```

Currently enabled payer routes:

```text
Arbitrum -> Base
Optimism -> Base
Polygon -> Base
Base -> Arbitrum
```

The route matrix is configuration-driven, so additional routes such as `Optimism -> Arbitrum` or `Polygon -> Arbitrum` can be enabled later without rewriting the main checkout flow.

## Tech Stack

- Next.js 16, React 19, TypeScript
- RainbowKit, Wagmi, Viem
- Z.AI GLM-5.1 through the OpenAI-compatible API
- LI.FI `quote/toAmount` and `status`
- Local JSON invoice store for hackathon demo usage

## Local Setup

Create `.env.local` in the project root:

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4

# Optional model overrides. By default, core ChainCashier agents use zai/glm-5.1.
# MAIN_AGENT_MODEL=zai/glm-5.1
# EARNING_AGENT_MODEL=zai/glm-5.1
# BRIDGE_AGENT_MODEL=zai/glm-5.1
# RISK_AGENT_MODEL=zai/glm-5.1
# MONITOR_AGENT_MODEL=zai/glm-5.1
# CHECKOUT_AGENT_MODEL=zai/glm-5.1

LIFI_API_KEY=
NEXT_PUBLIC_WC_PROJECT_ID=
```

Notes:

- `ZAI_BASE_URL=https://api.z.ai/api/paas/v4` uses `v4` as the API version path. The selected model is still `glm-5.1`.
- `NEXT_PUBLIC_WC_PROJECT_ID` enables RainbowKit / WalletConnect branded wallet options. Without it, the app usually falls back to injected browser wallets.

Install and run:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Guide

Use a small real mainnet amount only.

1. Open `/` and enter the merchant chat.
2. Connect the merchant wallet.
3. Send: `Create an invoice to receive 1 USDC on Base for a live test.`
4. Copy the generated `/pay/[invoiceId]` link.
5. Open the link in an independent payer wallet environment.
6. Send: `I want to pay with USDC on Arbitrum.`
7. Review the LI.FI quote card and Agent Run Timeline.
8. Click `Approve & Pay With Wallet`.
9. Confirm wallet approval and payment.
10. Wait for LI.FI status polling to complete.
11. Export the Run Log and receipt package.

## Wallet Boundary

Merchant and payer pages use separate Wagmi storage keys:

```text
merchant: chaincashier.merchant.wagmi
payer:    chaincashier.payer.wagmi
```

This reduces app-level wallet cache overlap. After an invoice is created, the checkout page reads the locked merchant address from the invoice, so the merchant wallet does not need to remain connected.

This does not override browser wallet extension behavior. The same Chrome profile and the same MetaMask extension still share global account and disconnect state. For live demos, use a separate browser profile, incognito window, Edge, a mobile WalletConnect wallet, or another independent wallet environment for the payer.

## Safety Boundaries

- Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
- ChainCashier does not custody funds.
- ChainCashier does not store private keys.
- ChainCashier does not automatically spend user assets.
- Merchant address, target chain, target token, and receive amount are locked in the invoice.
- The payer cannot change merchant receiving terms.
- Quotes are blocked if LI.FI target address, chain, token, or amount does not match the locked invoice.
- Receipt proof is evidence, not a platform settlement guarantee.

## Important Files

- `components/LandingHero.tsx`: home page and hackathon showcase content.
- `components/DemoVideoCard.tsx`: home page demo video modal.
- `components/ChainCashierChat.tsx`: merchant and payer chat UI, typewriter response, Agent Run Timeline, Run Log export.
- `lib/chainCashier.ts`: invoice model, quote request builder, quote safety validation, receipt package.
- `lib/chainCashierChains.ts`: supported chains, USDC addresses, and route matrix.
- `lib/chainCashierRun.ts`: Agent Run events and exportable Run Log structure.
- `lib/agentConfig.ts` and `lib/agentClient.ts`: GLM-5.1 / Z.AI configuration.
- `lib/lifiClient.ts`: LI.FI quote and status client.
- `app/api/chaincashier/chat/route.ts`: streaming chat endpoint.
- `app/api/payments/quote/route.ts`: LI.FI quote wrapper.
- `app/api/payments/status/route.ts`: LI.FI status tracking.
- `app/api/receipts/generate/route.ts`: receipt/support package generation.
- `app/pitch/route.ts` and `public/pitch/`: static pitch deck.
- `public/demo/chaincashier-demo.mp4`: 2-minute demo video.

## Verification

```bash
node --test
npm run lint
npm run build
```

`npm run lint` may show existing warnings, but it should not show errors. `npm run build` may show a Turbopack tracing warning, but the build should complete successfully.

## Submission Materials

Recommended hackathon package:

- GitHub repository and README
- Live Vercel demo link
- `/pitch` presentation page
- 2-minute demo video
- Run Log JSON from a real or small-amount mainnet test
- Wallet transaction hashes and explorer links
- Receipt/support package
- Safety boundary explanation
