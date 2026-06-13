# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install
npm run dev        # Next.js dev server on http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint (flat config: eslint.config.mjs)
npx tsc --noEmit   # type-check without emitting
```

### Tests (important — non-obvious harness)

There is **no test runner and no `test` script**. Tests are plain `.mjs` files run directly with Node's built-in test runner (`node:test` + `node:assert/strict`). They do **not** import compiled JS — a custom loader, `tests/helpers/load-ts-module.mjs`, transpiles the imported `.ts` source on the fly via the `typescript` package into a temp dir (`.codex-test-tmp/`, gitignored) and rewrites `@/` and relative specifiers. Because of this, tests only exercise **pure library modules in `lib/`** — they cannot import React components or Next.js route handlers.

```bash
node tests/chain-cashier.test.mjs          # run a single test file
for f in tests/*.test.mjs; do node "$f"; done   # run all tests
```

Consequence: keep business logic (invoice math, quote validation, chain resolution, streaming) in pure `lib/*.ts` functions so they remain unit-testable. Route handlers stay thin wrappers around those functions.

## Architecture

ChainCashier is an AI cross-chain checkout agent: a merchant creates a USDC invoice through a chat driven by GLM-5.1, the app emits a `/pay/[invoiceId]` link, and a payer in a **separate browser session** picks a source chain. The app gets a LI.FI `quote/toAmount` so the merchant receives an exact amount, the payer's wallet executes the route, and the app polls LI.FI status until it can mint a receipt. See `README.md` for the full demo flow and safety boundaries.

### The checkout is a two-party split

The merchant flow (`app/page.tsx`) and payer flow (`app/pay/[invoiceId]/page.tsx`) are deliberately decoupled:

- **Wallet isolation**: `lib/wagmi.config.ts` creates a Wagmi config **per role** with separate `localStorage` storage keys (`chaincashier.merchant.wagmi` vs `chaincashier.payer.wagmi`). This does not override injected-wallet extension behavior, so demos should use a separate browser profile / incognito / another device for the payer.
- **Invoice is the handoff**: the invoice JSON (persisted by `lib/chainCashierStore.ts`) is the only thing linking the two sessions. The payer page reads the locked merchant address from it — the merchant wallet need not stay connected.
- **Store is demo-only**: `lib/chainCashierStore.ts` is an in-memory `Map` lazily loaded from / persisted to `.chaincashier-data/invoices.json` (path overridable via `CHAINCASHIER_STORE_PATH`). It is not a real database.

### Where the LLM is (and isn't) used

The **merchant invoice-creation step** is the only LLM call, made in `app/api/chaincashier/chat/route.ts` via `generateObject` with a zod schema and the `checkout` agent config. If it fails, parsing falls back to deterministic helpers in `lib/chainCashierChat.ts`. **Everything else is deterministic** — payer source-chain parsing, quote building, validation, status polling, receipt hashing are all pure functions. Do not add LLM calls to the payer path or to value-transfer logic.

### Model / provider plumbing

`lib/agentConfig.ts` + `lib/agentClient.ts` are a multi-provider factory over the AI SDK. `getAgentConfig('checkout')` reads a `<NAME>_AGENT_MODEL` env override (e.g. `CHECKOUT_AGENT_MODEL=zai/glm-5.1`); the `provider/model` string is parsed to pick both the model and which API-key env var to read. Defaults: the `checkout` agent uses `zai/glm-5.1`, the other agent slots (`main`, `earning`, `bridge`, `risk`, `monitor`) default to DeepSeek. `lib/agentClient.ts` maps each provider to the right AI SDK package (`createOpenAI` for OpenAI-compatible endpoints like DeepSeek and Z.AI; dedicated packages for Anthropic, Alibaba, Zhipu, Moonshot).

### The locked-terms safety invariant

Merchant receiving terms (address, chain, token, amount) are **locked** when the invoice is created in `createInvoiceFromAgentOutput`. `summarizePaymentQuote` in `lib/chainCashier.ts` **throws** if a returned LI.FI quote's target address, target chain, or target token does not match the locked invoice — this is the core protection against the payer (or a bad route) changing settlement terms. Never relax these checks. The full invariant set is in README's "Safety Boundaries".

### Supported chains

`lib/chainCashierChains.ts` defines USDC addresses for Base, Arbitrum, Optimism, Polygon. **Settlement (receiving) is Base or Arbitrum only**; `CHAINCASHIER_PAYMENT_ROUTES` constrains which source chains may pay into each (Base accepts Arb/Optimism/Polygon; Arbitrum accepts Base). USDC uses 6 decimals (`parseUnits(amount, 6)`).

### Chat streaming protocol

`app/api/chaincashier/chat/route.ts` is an SSE endpoint (`text/event-stream`) that emits typed `ChainCashierChatChunk`s — `thinking`, `run_event`, `invoice`, `quote_request`, `quote`, `response`, `error`, `done`. `run_event` events (built by `lib/chainCashierRun.ts`) drive the right-side "Payment Flow Recorder", mirroring long-horizon task state step by step. `lib/chainCashierStreaming.ts` (`splitTypewriterText`) re-splits these into typewriter tokens the UI reveals. **Adding a checkout step = emit a new chunk type, handle it in the streaming layer, and render it in `components/ChainCashierChat.tsx`.**

### LI.FI client

`lib/lifiClient.ts` is a thin fetch wrapper around `li.quest/v1/quote`, `/quote/toAmount`, `/status`, plus `earn.li.fi` vault endpoints. It attaches `x-lifi-api-key` only when `LIFI_API_KEY` is set. Route handlers in `app/api/payments/{quote,status,submit}/` wrap these for the client. The app **never signs** — it prepares the `transactionRequest` and hands it to the user's wallet for execution.

## Conventions

- **TypeScript strict**, App Router, Route Handlers (`app/api/**/route.ts`) with `export const runtime = 'nodejs'` where needed.
- Path alias `@/*` → repo root (e.g. `@/lib/chainCashier`).
- **Indentation is tabs** throughout `lib/` and `app/` — match this when editing.
- The README's "Important Files" section is the authoritative map of which file owns what.
