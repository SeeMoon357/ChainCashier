# ChainCashier

ChainCashier 是一个面向 PayFi 商户的 AI 跨链收银台 Agent。

商户通过 ChatGPT 式聊天创建 Base USDC 收款单。生成的 payment link 会打开独立付款人聊天页，付款人可以直接对 Agent 说自己想从哪条链支付。Agent 负责拆解任务、调用 LI.FI 报价和状态查询、解释费用与风险、准备钱包交易、追踪支付状态，并生成 receipt 与 support package。

## 黑客松定位

本项目面向 Z.AI Web3 x Long-Horizon Task 赛道。

- 核心 checkout planning 由 GLM-5.1 驱动。
- Demo 是多步骤 Web3 工作流，不是一次性问答。
- 可展示流式回复、thinking/tool trace、任务拆解、工具调用、钱包确认、LI.FI quote/status、receipt 交付。
- Agent 不签名、不托管资产、不自动转账，真实交易由用户钱包确认。

## 核心流程

1. 商户打开 `/` 并输入：`Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
2. GLM-5.1 解析出结构化 invoice，并流式展示 reasoning/tool trace。
3. 系统生成 invoice ID 和 `/pay/[invoiceId]` payment link。
4. 付款人在另一个浏览器、无痕窗口、手机钱包浏览器或切换钱包账户后打开 payment link。
5. 付款人输入：`I want to pay with USDC on Arbitrum.`
6. 应用调用 LI.FI `quote/toAmount`，确保商户收到指定数量的 Base USDC。
7. 聊天消息展示付款人预计支付金额、费用、滑点边界和钱包确认要求。
8. 付款人按需授权 USDC，并提交 LI.FI route transaction。
9. 应用保存 `sourceTxHash` 并轮询 LI.FI status。
10. 支付完成后生成 receipt JSON 和 support package。

## 技术栈

- Next.js 16 / React 19 / TypeScript
- RainbowKit + Wagmi + Viem 多钱包连接与钱包交易
- Z.AI GLM-5.1 OpenAI-compatible 接入
- LI.FI `quote/toAmount` 与 `status`
- 本地黑客松 Demo 使用本地 JSON invoice store

## 环境变量

复制 `.env.local.example` 为 `.env.local`，填写：

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
CHECKOUT_AGENT_MODEL=zai/glm-5.1

LIFI_API_KEY=

NEXT_PUBLIC_WC_PROJECT_ID=
```

`NEXT_PUBLIC_WC_PROJECT_ID` 用于 RainbowKit / WalletConnect 多品牌钱包连接。如果不配置，Wagmi 会退回到浏览器注入钱包，观感上通常只像 MetaMask/Rabby 这类钱包。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Demo 脚本

只建议使用小额真实主网金额。

1. 打开 `/`，连接商户钱包。
2. 发送：`Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
3. 复制生成的 `/pay/[invoiceId]` 链接。
4. 在另一个浏览器配置、无痕窗口、手机钱包浏览器，或切换钱包账户后打开该链接。
5. 连接付款人钱包。
6. 发送：`I want to pay with USDC on Arbitrum.`
7. 检查流式 reasoning/tool trace 和 LI.FI quote card。
8. 点击 `Approve & Pay With Wallet`。
9. 如钱包要求，确认 USDC 授权。
10. 确认 route transaction。
11. 等待 LI.FI status polling 生成 receipt。

## 安全边界

- Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
- ChainCashier 不托管资金。
- ChainCashier 不持有私钥。
- ChainCashier 不自动花费用户资产。
- 商户地址、目标链、目标 token、收款金额在 invoice 中锁定。
- 付款人不能修改商户收款条件。
- 如果 LI.FI quote 的目标地址、目标链或目标 token 与 invoice 不一致，系统会阻断。
- Receipt proof 是支付证据，不是平台担保。

## 关键文件

- `components/ChainCashierChat.tsx`：ChatGPT 风格商户/付款人聊天 UI。
- `lib/chainCashier.ts`：invoice、quote 安全校验、receipt/support package。
- `lib/chainCashierChat.ts`：聊天流 planning helper 和付款人来源链解析。
- `lib/chainCashierStore.ts`：本地 JSON invoice store，支持商户端/付款端分开演示。
- `lib/agentConfig.ts` / `lib/agentClient.ts`：GLM-5.1 / Z.AI 模型配置。
- `lib/lifiClient.ts`：LI.FI quote/status client。
- `app/api/chaincashier/chat/route.ts`：SSE 流式聊天 endpoint。
- `app/api/chaincashier/agent/route.ts`：结构化 invoice planning endpoint。
- `app/api/payments/quote/route.ts`：LI.FI `quote/toAmount` wrapper。
- `app/api/payments/status/route.ts`：LI.FI status tracking。
