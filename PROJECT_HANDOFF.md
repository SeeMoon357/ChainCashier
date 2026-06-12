# Avalokita Project Handoff

## 1. Project Background

Avalokita is a hackathon project for the LI.FI `AI x Earn` track.

Its goal is not to build a fully autonomous on-chain agent. Instead, it aims to build a **constrained, tool-driven AI Earn agent** that can:

- understand a user's natural-language Earn intent
- call safe tools to fetch real vault and quote data
- generate a recommendation and execution preview
- let the user confirm and execute through their wallet

The core principle is:

**model for understanding and explanation, tools for facts, deterministic runtime for execution truth**

This boundary is intentional and important. The model must not directly claim that a transaction executed, and it must not directly send on-chain transactions.

## 2. Product Vision

The long-term vision is a natural-language interface for DeFi Earn flows.

Examples of the desired product experience:

- `Find the best available USDC vault on Base`
- `Deposit 5 USDC into the safest vault on Arbitrum`
- `Move 100 USDC from Base into the best USDC vault on Arbitrum`

The intended end state is:

- users describe intent in plain language
- the agent gathers facts via LI.FI-backed tools
- the UI shows recommendation, reasoning, fees, route, and execution preview
- the user explicitly confirms wallet actions
- later versions may extend into monitoring, rebalancing, and broader cross-chain Earn coverage

At the current stage, the project prioritizes **demo stability, controllability, and credibility**, not production-grade autonomy.

## 3. Current Status

The project has moved beyond an early prototype and is now a working **tool-driven AI Earn v1**.

Recent milestone commits:

- `f20c8ac` `fix: restore visible new conversation creation flow`
- `534a69e` `feat: add constrained cross-chain earn preview and execution flow`
- `cecbdfc` `fix: stabilize earn demo flow`
- `68105c6` `feat: add deterministic earn execution preflight and approval flow`

Current branch situation at handoff time:

- local branch in use: `main`
- `main` and `windows-base-pre-step2` are aligned on the same latest handoff commit series
- `windows-base-pre-step2` is retained as a backup / rollback anchor

The system can now do all of the following in a constrained way:

- recommend USDC vaults
- build LI.FI-based quote data
- generate execution preview cards
- run wallet execution with preflight + approval + main transaction
- support a limited cross-chain Earn v1 flow
- create visible new conversations reliably from both sidebar and homepage prompts

## 4. What Is Officially Supported Right Now

### Asset

Only one asset is officially supported:

- `USDC`

This is not a multi-asset product yet. Many assumptions in planner, quote building, and execution are USDC-specific.

### Business-Supported Chains

The core business logic is officially centered on:

- Ethereum `1`
- Base `8453`
- Arbitrum `42161`

Important nuance:

- [lib/chains.ts](D:/CApp/Avalokita/lib/chains.ts) already contains `Polygon (137)` and `Optimism (10)`
- but business logic, planner support, and execution support are **not yet fully opened** for them

Do not assume "present in config" means "fully supported in product."

### Same-Chain Earn

The most stable path is same-chain USDC Earn.

Examples:

- `Base -> Base`
- `Arbitrum -> Arbitrum`
- `Ethereum -> Ethereum`

`Base -> Base` is one of the main stable demo baselines.

### Cross-Chain Earn v1

Cross-chain Earn has been added in a constrained v1 form.

Currently intended supported cross-chain execution pairs:

- `Ethereum -> Base`
- `Ethereum -> Arbitrum`
- `Base -> Arbitrum`
- `Arbitrum -> Base`

Currently blocked / not formally opened:

- `Base -> Ethereum`
- `Arbitrum -> Ethereum`

Important execution truth for cross-chain v1:

- a `confirmed` status in the UI means the **source-chain route transaction** has been confirmed
- it does **not** mean the destination-side vault deposit has been fully tracked to completion

This distinction must be preserved in future work.

## 5. Agent Architecture

This project is **not** a free-form ReAct agent that can do anything.

It is better described as:

**Planner + constrained tool calling + deterministic execution/runtime**

Key files:

- [app/api/agents/agents/main.ts](D:/CApp/Avalokita/app/api/agents/agents/main.ts)
- [app/api/agents/agents/earning.ts](D:/CApp/Avalokita/app/api/agents/agents/earning.ts)
- [lib/plannerRuntime.ts](D:/CApp/Avalokita/lib/plannerRuntime.ts)

### Main flow

1. Main planner produces a structured plan
2. If the plan intent is `earn.deposit`, execution enters the earn agent flow
3. The earn agent uses a limited tool set to gather facts
4. Runtime builds a deterministic execution preview
5. Frontend shows recommendation + steps + preview
6. User click triggers wallet execution outside the model

### Planner intents

Planner recognizes:

- `earn.deposit`
- `bridge`
- `monitor`
- `unknown`

But only `earn.deposit` is currently the real mainline.

`bridge` and `monitor` are still effectively placeholder / unsupported in the main user experience.

### Tool policy

The earn agent currently uses a constrained allowlist of tools, including:

- `listVaults`
- `getVaultDetail`
- `getPortfolio`
- `estimateYield`
- `buildComposerQuote`

Model constraints already enforced in prompt and architecture:

- must fetch facts before recommending
- must not invent vaults, APY, TVL, fees, or quotes
- should build quote only after amount and selected vault are known
- must never claim the transaction has already executed
- must not directly send on-chain transactions

## 6. LI.FI Integration Strategy

The current project does **not** use `@lifi/sdk` as the main execution backbone.

Instead, it uses a **REST-based LI.FI integration** with a domain layer on top.

Key files:

- [lib/lifiClient.ts](D:/CApp/Avalokita/lib/lifiClient.ts)
- [lib/lifiDomain.ts](D:/CApp/Avalokita/lib/lifiDomain.ts)

Reasoning behind this choice:

- smaller refactor surface for the hackathon timeline
- easier control over returned shapes
- faster reuse of existing code
- lower integration risk during rapid iteration

This does not mean the SDK is bad. It means the project deliberately chose a smaller, more controllable integration path for v1.

## 7. Execution Layer Status

Key files:

- [lib/executionRuntime.ts](D:/CApp/Avalokita/lib/executionRuntime.ts)
- [lib/executionHelpers.ts](D:/CApp/Avalokita/lib/executionHelpers.ts)
- [lib/executionClient.ts](D:/CApp/Avalokita/lib/executionClient.ts)

### What changed from earlier versions

The system no longer does a naive "just send one `transactionRequest`" flow.

It now uses a more honest execution sequence:

1. run preflight
2. verify wallet / chain / quote / approval target / gas / allowance
3. if needed, request ERC20 approval first
4. wait for approval receipt
5. submit the main route / deposit transaction
6. wait for receipt
7. update UI state to `confirmed` or `failed`

### Current execution state machine

The client-side execution status includes:

- `idle`
- `preflighting`
- `awaiting_wallet_approval`
- `approving`
- `approved`
- `awaiting_wallet_execution`
- `submitting`
- `submitted`
- `confirmed`
- `failed`

### Important behavior guarantees

The project has already improved several misleading cases:

- if wallet never broadcasts, UI should not pretend it is truly submitted
- if the user rejects approval or execution, state should fall to `failed`
- approval and main execution are distinguished
- failures should produce explicit state and error summary rather than fake success

## 8. Frontend and Demo UX

This is a Next.js App Router project using:

- Next.js `16.2.1`
- React `19.2.4`
- `ai` SDK
- `wagmi`
- `RainbowKit`
- `viem`
- `antd`

Relevant files:

- [package.json](D:/CApp/Avalokita/package.json)
- [components/Prompt.tsx](D:/CApp/Avalokita/components/Prompt.tsx)
- [components/ExecutionPreviewCard.tsx](D:/CApp/Avalokita/components/ExecutionPreviewCard.tsx)
- [components/ChatContent.tsx](D:/CApp/Avalokita/components/ChatContent.tsx)

Current homepage prompt examples:

- `Find the best available USDC vault on Base`
- `Go ahead and deposit 0.1 USDC into the best available USDC vault on Base`
- `Deposit 5 USDC into the safest vault on Arbitrum`
- `Move 10 USDC from Base into the best USDC vault on Arbitrum`

Recent UI fix already landed:

- "new conversation" creation is visible again
- clicking a homepage centered prompt without selecting a history conversation now opens a fresh conversation by default

## 9. Important Current Constraints

These are easy for a new engineer or AI to misunderstand.

### Only USDC is official

Do not accidentally expand assumptions to multiple tokens.

### `bridge` and `monitor` are not full product flows yet

Planner can recognize them, but the product is still centered on Earn.

### No amount means blocked execution by design

If the user only asks a recommendation question such as:

- `Find the best available USDC vault on Base`

Then the system should:

- return a recommendation
- but keep execution blocked

This is intentional, not a bug.

### Cross-chain confirmed is not full route completion

The current v1 UX only guarantees truthful reporting of the source-chain transaction state.

### Chain support is not fully centralized yet

Although some pieces have been abstracted, chain support is still spread across:

- planner logic
- prompt constraints
- chain label helpers
- wallet context
- USDC token address mapping
- supported cross-chain pair checks
- tests

This means future target-chain expansion should start with configuration centralization rather than more scattered conditionals.

### Wagmi supports more chains than the business layer

[lib/wagmi.config.ts](D:/CApp/Avalokita/lib/wagmi.config.ts) includes:

- mainnet
- base
- arbitrum
- polygon
- optimism
- sepolia
- baseSepolia
- arbitrumSepolia

But product support is narrower than wallet transport support.

## 10. Recommended Reading Order for a New AI

To understand the project quickly, start here:

### Agent and orchestration

- [app/api/agents/agents/main.ts](D:/CApp/Avalokita/app/api/agents/agents/main.ts)
- [app/api/agents/agents/earning.ts](D:/CApp/Avalokita/app/api/agents/agents/earning.ts)

### Planner and chain support

- [lib/plannerRuntime.ts](D:/CApp/Avalokita/lib/plannerRuntime.ts)
- [lib/chains.ts](D:/CApp/Avalokita/lib/chains.ts)

### LI.FI access and domain

- [lib/lifiClient.ts](D:/CApp/Avalokita/lib/lifiClient.ts)
- [lib/lifiDomain.ts](D:/CApp/Avalokita/lib/lifiDomain.ts)

### Execution and wallet

- [lib/executionRuntime.ts](D:/CApp/Avalokita/lib/executionRuntime.ts)
- [lib/executionHelpers.ts](D:/CApp/Avalokita/lib/executionHelpers.ts)
- [lib/executionClient.ts](D:/CApp/Avalokita/lib/executionClient.ts)

### UI

- [components/ExecutionPreviewCard.tsx](D:/CApp/Avalokita/components/ExecutionPreviewCard.tsx)
- [components/ChatContent.tsx](D:/CApp/Avalokita/components/ChatContent.tsx)
- [components/Prompt.tsx](D:/CApp/Avalokita/components/Prompt.tsx)

## 11. Tests

The project is not testless. It currently includes multiple `.mjs` test files covering areas such as:

- planner runtime
- execution runtime
- execution helpers
- agent steps
- wallet context
- LI.FI runtime logic
- conversation runtime

This is not production-level coverage, but it is enough that future behavior changes should continue to be backed by targeted tests.

Recommended discipline for future work:

- any behavior change should add or update tests
- especially for:
  - chain support expansion
  - cross-chain pair expansion
  - execution eligibility changes
  - new blocked reasons
  - planner parsing behavior

## 12. Most Sensible Next Step

The next best engineering move is **not** a giant refactor and **not** opening many chains at once.

The recommended next step is:

1. centralize chain support into one configuration layer
2. then add new target chains in small batches, ideally one at a time or at most two

That central configuration should eventually cover:

- officially supported business chains
- target-chain allowlist
- allowed cross-chain Earn pairs
- per-chain USDC token addresses
- chain labels and explorer metadata

Only after that should broader target-chain expansion proceed.

## 13. Key Principle for Future Contributors

The most important architectural principle to preserve is:

**the model explains, the tools provide facts, and the runtime decides whether execution is actually allowed**

If future changes break this boundary, the product will regress into a less trustworthy system that may sound capable but behaves ambiguously or dishonestly.

## 14. Local Startup

Basic local start:

```powershell
cd D:\CApp\Avalokita
npm install
npm run dev
```

If wallet connection or environment issues appear, check local environment variables and wallet configuration separately.

## 15. Short Handoff Summary

If another AI needs the shortest possible summary:

- This is a LI.FI hackathon `AI x Earn` project
- It is a constrained tool-calling Earn agent, not a fully autonomous agent
- Official mainline is USDC Earn, with same-chain as the stable baseline
- Cross-chain Earn v1 exists, but only for limited supported pairs and with source-tx-only confirmation semantics
- Execution is guarded by deterministic preflight, approval, and wallet submission logic
- `bridge` and `monitor` are not full official flows yet
- Next major improvement should be centralized chain support configuration before expanding more target chains
