<p align="right">
  English | <a href="./DEPLOYMENT.zh-CN.md">简体中文</a>
</p>

# Deployment Guide

This project is a Next.js application with a server-side agent route, LI.FI API access, and wallet connection through RainbowKit / WalletConnect.

The deployment model is intentionally straightforward: configure environment variables, run the Next.js app, and connect a wallet for end-to-end verification.

## Prerequisites

- Node.js `22`
- npm
- A wallet for testing frontend execution flows
- At least one supported AI provider key

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example file and fill in the values you actually want to use:

```bash
cp .env.local.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

### Required or commonly used variables

#### AI provider keys

At least one provider must be configured for the agent runtime.

- `QWEN_API_KEY`
- `QWEN_BASE_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `ZHIPU_API_KEY`

You do not need every provider. Use the one your selected model requires.

#### LI.FI configuration

- `LIFI_API_KEY`
  Optional. Increases server-side LI.FI request capacity and is recommended for production or demo reliability.
- `NEXT_PUBLIC_LIFI_EARN_DATA_URL`
  Defaults to `https://earn.li.fi`

#### Wallet configuration

- `NEXT_PUBLIC_WC_PROJECT_ID`
  Required for wallet connection through WalletConnect / RainbowKit

#### Optional model overrides

You can override agent models per role:

- `MAIN_AGENT_MODEL`
- `EARNING_AGENT_MODEL`
- `BRIDGE_AGENT_MODEL`
- `RISK_AGENT_MODEL`
- `MONITOR_AGENT_MODEL`

## 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Verify the app

Minimum local verification checklist:

1. Open the homepage and confirm the chat UI loads
2. Connect a wallet successfully
3. Send a simple prompt such as `Find the best available USDC vault on Base`
4. Confirm the app can stream an agent response
5. Confirm `GET /api/agents` returns a healthy JSON response

Example quick health check:

```bash
curl http://localhost:3000/api/agents
```

Expected shape:

```json
{
  "status": "ok",
  "message": "Agent API is running",
  "supportedIntents": ["earn"],
  "version": "2.0.0"
}
```

## 5. Production deployment

### Recommended: Vercel

This project is a standard Next.js app and is a natural fit for Vercel.

Recommended production settings:

- Build command: `npm run build`
- Start command: `npm run start`
- Framework preset: `Next.js`

You must provide the same environment variables in the deployment platform:

- selected AI provider keys
- `NEXT_PUBLIC_WC_PROJECT_ID`
- optional `LIFI_API_KEY`
- any per-agent model overrides you rely on

### Generic Node deployment

You can also deploy it to any environment that supports Next.js production builds:

```bash
npm run build
npm run start
```

Make sure the runtime has access to the same environment variables that you used locally.

## Common Issues

### Wallet does not connect

Most commonly caused by a missing or invalid `NEXT_PUBLIC_WC_PROJECT_ID`.

### Agent requests fail immediately

Usually means the selected AI provider key is missing, invalid, or mismatched with the configured model.

### LI.FI quote is unavailable

Possible causes include:

- missing or rate-limited LI.FI access
- unsupported chain / asset / vault combination
- route not available for the requested amount

Treat this as a route or integration availability issue and verify the exact quote path before changing product logic.

### Cross-chain route finishes but user does not see the token

The user may have received a destination-chain vault share token rather than plain USDC. In that case:

- confirm the final LI.FI route result
- inspect the receiving transaction
- switch the wallet to the destination chain
- manually import the token contract if the wallet does not show it automatically

### Polygon flow needs gas later

This version does not include destination-chain gas refueling. A user may still need `POL` later for manual follow-up actions on Polygon.

## Recommended Demo Setup

For the smoothest demo run:

- configure one stable AI provider first
- set `NEXT_PUBLIC_WC_PROJECT_ID`
- optionally add `LIFI_API_KEY`
- start with same-chain USDC flows
- then test constrained cross-chain flows such as Base to Arbitrum or Base to Polygon
