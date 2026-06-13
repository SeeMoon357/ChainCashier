# ChainCashier

**EN**: GLM-5.1 powered long-horizon cross-chain checkout agent for Web3 / PayFi merchants.

**中文**：ChainCashier 是一个由 GLM-5.1 驱动的 Web3 / PayFi 跨链收款 Agent。

---

## Overview / 项目简介

**EN**

ChainCashier lets a merchant create a Base or Arbitrum USDC invoice through a ChatGPT-style agent chat. The generated payment link opens a separate payer chat, where the payer can choose the source chain. The agent plans the workflow, calls LI.FI `quote/toAmount`, validates the quote against the locked invoice, explains costs and safety boundaries, prepares wallet transactions, tracks LI.FI status, and generates a receipt plus support package.

**中文**

ChainCashier 允许商户通过 ChatGPT 式聊天创建 Base 或 Arbitrum USDC 收款单。系统生成独立付款链接，付款人进入后可选择来源链。Agent 会拆解任务、调用 LI.FI `quote/toAmount`、校验报价是否匹配锁定账单、解释费用和安全边界、准备钱包交易、追踪 LI.FI 状态，并生成 receipt 与 support package。

---

## Hackathon Fit / 黑客松匹配度

**EN**

This project targets the Z.AI Web3 x Long-Horizon Task track.

- GLM-5.1 is the default model for all core agents.
- The product is a multi-step Web3 workflow, not a one-shot chatbot.
- The demo shows task decomposition, streaming reasoning/tool traces, real tool calls, quote validation, wallet confirmation, LI.FI quote/status tracking, controlled repair steps, and final receipt generation.
- The agent never signs or custodies funds. User wallets execute transactions.

**中文**

本项目面向 Z.AI Web3 x Long-Horizon Task 赛道。

- GLM-5.1 是所有核心 Agent 的默认模型。
- Demo 是多步骤 Web3 工作流，不是一次性问答或普通 API 调用。
- Demo 展示任务拆解、流式 reasoning/tool trace、真实工具调用、quote 校验、钱包确认、LI.FI quote/status 追踪、受控修复步骤和最终 receipt 交付。
- Agent 不签名、不托管资金；真实交易必须由用户钱包执行。

---

## Core Flow / 核心流程

**EN**

1. Merchant opens `/` and chats: `Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
2. GLM-5.1 parses the request into a locked invoice and streams the reasoning/tool trace.
3. ChainCashier generates an invoice ID and `/pay/[invoiceId]` payment link.
4. Payer opens the payment link in a separate browser, wallet, or account.
5. Payer chats: `I want to pay with USDC on Arbitrum.`
6. The app calls LI.FI `quote/toAmount` so the merchant receives the exact target-chain USDC amount.
7. The app validates target address, target chain, and target token against the locked invoice.
8. Payer approves USDC if required and submits the LI.FI route transaction.
9. The app saves `sourceTxHash` and polls LI.FI status.
10. When LI.FI reports completion, ChainCashier generates a receipt JSON and support package.

**中文**

1. 商户打开 `/`，发送：`Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
2. GLM-5.1 将请求解析为锁定收款单，并流式展示 reasoning/tool trace。
3. ChainCashier 生成 invoice ID 和 `/pay/[invoiceId]` 付款链接。
4. 付款人在独立浏览器、钱包或账号环境中打开付款链接。
5. 付款人发送：`I want to pay with USDC on Arbitrum.`
6. 应用调用 LI.FI `quote/toAmount`，确保商户收到目标链上的精确 USDC 金额。
7. 应用校验目标地址、目标链、目标 token 是否匹配锁定 invoice。
8. 付款人按需 approve USDC，并提交 LI.FI route transaction。
9. 应用保存 `sourceTxHash` 并轮询 LI.FI status。
10. LI.FI 报告完成后，ChainCashier 生成 receipt JSON 和 support package。

The right-side **Agent Run Timeline** mirrors the long-horizon task state and can export a Run Log JSON for hackathon review.

右侧 **Agent Run Timeline** 会展示长程任务状态，并可导出 Run Log JSON 作为参赛材料。

---

## Supported Routes / 当前支持路线

```text
Arbitrum -> Base
Optimism -> Base
Polygon -> Base
Base -> Arbitrum
```

**EN**: Merchant settlement targets currently support Base USDC and Arbitrum USDC. The route matrix is configuration-driven, so more routes can be enabled later without changing the main flow.

**中文**：商户收款目标链当前支持 Base USDC 和 Arbitrum USDC。路线由配置表驱动，后续可继续开放更多路线而不重构主流程。

---

## Tech Stack / 技术栈

- Next.js 16 / React 19 / TypeScript
- RainbowKit + Wagmi + Viem
- Z.AI GLM-5.1 through the OpenAI-compatible API
- LI.FI `quote/toAmount` and `status`
- Local JSON invoice store for hackathon demo

---

## Environment / 环境变量

Create `.env.local` in the project root.

在项目根目录创建 `.env.local`：

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4

# Optional overrides. By default, all core ChainCashier agents use zai/glm-5.1.
# 可选覆盖项。默认所有核心 ChainCashier agents 都使用 zai/glm-5.1。
# MAIN_AGENT_MODEL=zai/glm-5.1
# EARNING_AGENT_MODEL=zai/glm-5.1
# BRIDGE_AGENT_MODEL=zai/glm-5.1
# RISK_AGENT_MODEL=zai/glm-5.1
# MONITOR_AGENT_MODEL=zai/glm-5.1
# CHECKOUT_AGENT_MODEL=zai/glm-5.1

LIFI_API_KEY=

NEXT_PUBLIC_WC_PROJECT_ID=
```

**EN**: `ZAI_BASE_URL=https://api.z.ai/api/paas/v4` uses `v4` as the API version path. The model is selected by `glm-5.1`.

**中文**：`ZAI_BASE_URL=https://api.z.ai/api/paas/v4` 里的 `v4` 是 API 版本路径，不是 GLM-4 模型。真正决定模型的是 `glm-5.1`。

**EN**: `NEXT_PUBLIC_WC_PROJECT_ID` lets RainbowKit show multi-brand WalletConnect wallets. Without it, the app usually falls back to injected browser wallets.

**中文**：`NEXT_PUBLIC_WC_PROJECT_ID` 用于 RainbowKit 展示多品牌 WalletConnect 钱包。没有它时，通常只能使用浏览器 injected 钱包。

---

## Run Locally / 本地运行

```bash
npm install
npm run dev
```

Open / 打开：

```text
http://localhost:3000
```

---

## Wallet Boundary / 钱包边界

**EN**

Merchant and payer pages use separate Wagmi storage keys:

```text
merchant: chaincashier.merchant.wagmi
payer:    chaincashier.payer.wagmi
```

This reduces app-level wallet cache overlap. After the merchant creates an invoice, the payer flow reads the locked merchant address from the invoice, so checkout does not require the merchant wallet to remain connected.

This does not override injected wallet extension behavior. The same Chrome profile and the same MetaMask extension still share global account/disconnect state. For demos, use a separate browser profile, incognito window, Edge, a phone WalletConnect wallet, or another independent wallet environment for the payer.

**中文**

商户端和付款端使用不同 Wagmi storage key：

```text
merchant: chaincashier.merchant.wagmi
payer:    chaincashier.payer.wagmi
```

这可以降低商户页和付款页在应用本地缓存上的互相污染。账单生成后，付款页读取 invoice 中已经锁定的商户收款地址，因此不依赖商户钱包持续在线。

但这不能改变钱包扩展自身的全局状态。同一个 Chrome profile 里的同一个 MetaMask 扩展，账号连接和断开仍然是全局的。Demo 建议使用独立浏览器 profile、无痕窗口、Edge、手机 WalletConnect 钱包或其他独立钱包环境。

---

## Live Demo Script / 真实资金验证脚本

Use a small real mainnet amount only.

只建议使用很小金额的真实主网资金。

1. Open `/` with the merchant wallet connected. / 打开 `/` 并连接商户钱包。
2. Send / 发送：`Create an invoice to receive 1 USDC on Base for a live test.`
3. Watch the typed streaming response and right-side Agent Run Timeline. / 观察流式回复和右侧 Agent Run Timeline。
4. Copy the generated `/pay/[invoiceId]` link. / 复制生成的付款链接。
5. Open that link in an independent payer wallet environment. / 在独立付款钱包环境中打开链接。
6. Connect the payer wallet. / 连接付款人钱包。
7. Send / 发送：`I want to pay with USDC on Arbitrum.`
8. Review the LI.FI quote card and quote validation evidence. / 检查 LI.FI quote card 和 quote validation evidence。
9. Click `Approve & Pay With Wallet`. / 点击 `Approve & Pay With Wallet`。
10. Confirm approval if the wallet asks. / 如钱包要求，确认 USDC approve。
11. Confirm the route transaction. / 确认 route transaction。
12. Wait for LI.FI status polling to generate the receipt. / 等待 LI.FI status polling 生成 receipt。
13. Export the Run Log JSON for submission. / 导出 Run Log JSON 作为提交材料。

---

## Safety Boundaries / 安全边界

**EN**

- Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
- ChainCashier does not custody funds.
- ChainCashier does not hold private keys.
- ChainCashier does not automatically spend user assets.
- Merchant address, target chain, target token, and receive amount are locked in the invoice.
- The payer cannot change merchant receiving terms.
- The quote is blocked if LI.FI target address, target chain, or target token differs from the locked invoice.
- When a quote or wallet action fails, the agent records a repair step and asks the user before trying another route.
- Receipt proof is evidence, not a settlement guarantee.

**中文**

- Agent 负责计划，用户钱包负责签名，LI.FI 负责路由，应用负责追踪，receipt 负责证明。
- ChainCashier 不托管资金。
- ChainCashier 不持有私钥。
- ChainCashier 不自动花费用户资产。
- 商户地址、目标链、目标 token、收款金额会被锁定在 invoice 中。
- 付款人不能修改商户收款条件。
- 如果 LI.FI quote 的目标地址、目标链或目标 token 与 invoice 不一致，系统会阻止继续支付。
- 如果 quote 或钱包操作失败，Agent 会记录 repair step，并要求用户确认下一步。
- Receipt proof 是支付证据，不是平台担保。

---

## Important Files / 关键文件

- `components/ChainCashierChat.tsx`: Chat UI, typewriter streaming, Agent Run Timeline, Run Log export.
- `lib/chainCashier.ts`: invoice model, quote request builder, quote safety validation, receipt/support package.
- `lib/chainCashierChat.ts`: chat planning helpers, payer source parsing, run event output.
- `lib/chainCashierRun.ts`: Agent Run events and exportable Run Log structure.
- `lib/chainCashierChains.ts`: supported chains, USDC addresses, route matrix.
- `lib/chainCashierStore.ts`: local JSON invoice store.
- `lib/wagmi.config.ts`: RainbowKit/Wagmi configuration with role-scoped storage.
- `lib/agentConfig.ts` / `lib/agentClient.ts`: GLM-5.1 / Z.AI model configuration.
- `lib/lifiClient.ts`: LI.FI quote/status client.
- `app/api/chaincashier/chat/route.ts`: SSE streaming chat endpoint.
- `app/api/payments/quote/route.ts`: LI.FI `quote/toAmount` wrapper.
- `app/api/payments/status/route.ts`: LI.FI status tracking.
- `app/api/receipts/generate/route.ts`: receipt/support package generation.

---

## Verification / 验证命令

```bash
node --test
npm run lint
npm run build
```

**EN**: `npm run lint` may still show existing warnings, but it should not show errors. `npm run build` may show one Turbopack tracing warning, but the build should complete successfully.

**中文**：`npm run lint` 可能仍有既有 warning，但不应有 error。`npm run build` 可能显示一个 Turbopack tracing warning，但构建应成功。

---

## Submission Checklist / 参赛材料建议

- GitHub repo and README / GitHub 仓库和 README
- 3-5 minute demo video / 3-5 分钟 demo 视频
- Real or small-amount mainnet Run Log JSON / 真实或小额主网测试 Run Log JSON
- LI.FI quote screenshot or exported record / LI.FI quote 截图或导出记录
- Wallet transaction hash / 钱包交易 hash
- Receipt/support package / receipt 和 support package
- Safety boundary explanation / 安全边界说明
