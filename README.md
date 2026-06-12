<p align="right">
  English | <a href="./README.zh-CN.md">简体中文</a>
</p>

# IntentLens

IntentLens is a LI.FI Intents builder education demo. It turns a natural-language USDC transfer goal into a mainnet LI.FI Intents quote attempt, then renders the result as a step-by-step flight recorder.

The MVP focuses on one canonical route:

```text
Base USDC -> Arbitrum USDC
```

This is not a solver implementation. IntentLens is an integrator-side demo: it builds the user intent, asks LI.FI Intents for a real mainnet solver quote/order preview, and explains what happened without pretending funds moved unless a wallet signature actually happens.

## What It Shows

- Natural-language goal parsing
- Mainnet LI.FI Intents quote/order-preview wiring
- A Flight Recorder for parse, intent build, solver quote, order preview, delivery, and settlement concepts
- A comparison with the classic LI.FI route-based flow from the original project
- Wallet safety boundaries: no automatic signing and no automatic spending

## Main Demo Prompt

```text
Move 10 USDC from Base to Arbitrum with best received amount
```

Other Earn prompts from the original project still work, for example:

```text
Find the best USDC vault on Base
```

## Safety Model

IntentLens uses mainnet quote/order-preview data. Any real transaction must still stop at wallet confirmation.

- No automatic signatures
- No automatic spending
- No self-operated solver
- No claim that an order is settled unless LI.FI returns that status

## Setup

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Create `.env.local` from `.env.local.example` and set:

```env
DEEPSEEK_API_KEY=
MAIN_AGENT_MODEL=deepseek/deepseek-v4-pro
EARNING_AGENT_MODEL=deepseek/deepseek-v4-pro
NEXT_PUBLIC_WC_PROJECT_ID=
LIFI_API_KEY=
```

`LIFI_API_KEY` is optional for the existing LI.FI route/Earn APIs. The Intents MVP targets the public mainnet order API at `https://order.li.fi`.

## Architecture

- `app/api/agents`: streams planner, route/Earn, and Intents events
- `lib/plannerRuntime.ts`: parses natural-language goals into structured plans
- `lib/lifiIntents.ts`: builds mainnet Intents quote requests and Flight Records
- `components/IntentFlightRecordCard.tsx`: renders the builder-facing execution trace
- Existing LI.FI Earn/route modules remain as the classic route baseline

## Tests

```bash
node tests/planner-runtime.test.mjs
node tests/agent-config.test.mjs
node tests/lifi-intents.test.mjs
npx tsc --noEmit
npm run build
```
