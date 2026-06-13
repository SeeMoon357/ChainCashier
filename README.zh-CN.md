# ChainCashier

ChainCashier 是一个面向 Web3 / PayFi 商户的 AI 跨链收款 Agent。

商户通过 ChatGPT 式聊天创建 Base 或 Arbitrum USDC 收款单。系统生成独立付款链接，付款人在 `/pay/[invoiceId]` 页面选择来源链并用自己的钱包确认支付。Agent 会拆解任务、调用 GLM-5.1 和 LI.FI、校验报价安全性、解释费用和权限边界、追踪支付状态，并生成 receipt 与 support package。

## 黑客松定位

本项目面向 Z.AI Web3 x Long-Horizon Task 赛道。

- GLM-5.1 是所有核心 Agent 的默认模型。
- Demo 是多步骤 Web3 工作流，不是一次性问答或普通 API 调用。
- 右侧 Agent Run Timeline 展示任务拆解、工具调用、quote 校验、钱包确认、状态追踪、受控修复和最终交付。
- Agent 不签名、不托管资金、不自动转账；真实交易必须由用户钱包确认。

一句话定位：

```text
ChainCashier is a GLM-5.1 powered long-horizon cross-chain checkout agent for Web3 merchants.
```

## 核心流程

1. 商户打开 `/` 并连接商户钱包。
2. 商户发送：`Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
3. GLM-5.1 将自然语言解析为结构化收款计划。
4. ChainCashier 锁定商户地址、目标链、目标 token、金额和费用策略。
5. 系统生成 invoice ID 和 `/pay/[invoiceId]` 付款链接。
6. 付款人在独立浏览器环境或独立钱包环境中打开付款链接。
7. 付款人发送：`I want to pay with USDC on Arbitrum.`
8. Agent 根据账单目标链筛选支持的来源链。
9. 系统调用 LI.FI `quote/toAmount`，确保商户收到精确目标金额。
10. 系统校验 LI.FI quote 的目标地址、目标链、目标 token 是否匹配锁定 invoice。
11. 付款人按需 approve USDC，并在钱包中确认 route transaction。
12. 系统保存 `sourceTxHash`，轮询 LI.FI status。
13. 支付完成后生成 receipt JSON 和 support package。
14. 右侧 Agent Run Timeline 可导出 Run Log JSON，用于参赛材料。

## 当前支持路线

当前开放路线：

```text
Arbitrum -> Base
Optimism -> Base
Polygon -> Base
Base -> Arbitrum
```

商户收款目标链：

```text
Base USDC
Arbitrum USDC
```

后续如需开放 `Optimism/Polygon -> Arbitrum`，只需要扩展路线配置，不需要重构主流程。

## 技术栈

- Next.js 16 / React 19 / TypeScript
- RainbowKit + Wagmi + Viem 多钱包连接和钱包交易
- Z.AI GLM-5.1 OpenAI-compatible API
- LI.FI `quote/toAmount` 和 `status`
- 本地 JSON invoice store，适合黑客松本地 demo

## 环境变量

在项目根目录创建 `.env.local`：

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4

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

说明：

- `ZAI_BASE_URL=https://api.z.ai/api/paas/v4` 里的 `v4` 是 API 版本路径，不是 GLM-4 模型。
- 模型由 `glm-5.1` 决定。
- `NEXT_PUBLIC_WC_PROJECT_ID` 用于 RainbowKit / WalletConnect 展示多品牌钱包。没有它时，通常只能看到浏览器 injected 钱包。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 钱包边界

商户端和付款端使用不同 Wagmi storage key：

```text
merchant: chaincashier.merchant.wagmi
payer:    chaincashier.payer.wagmi
```

这可以降低商户页和付款页在应用本地缓存上的互相污染。账单生成后，付款页读取 invoice 中已经锁定的商户收款地址，不依赖商户钱包持续在线。

但这不能改变钱包扩展自身的全局状态。也就是说，同一个 Chrome profile 里的同一个 MetaMask 扩展，账号连接和断开仍然是全局的。

真实演示建议：

- 商户端：Chrome 普通窗口 + 商户钱包
- 付款端：无痕窗口、另一个浏览器 profile、Edge、手机 WalletConnect 钱包，或其他独立钱包环境

## 真实资金验证脚本

只建议使用很小金额的真实主网资金。

1. 打开 `/`。
2. 连接商户钱包。
3. 发送：`Create an invoice to receive 1 USDC on Base for a live test.`
4. 等待聊天流式回复完成。
5. 展开右侧 Agent Run Timeline，确认有 GLM-5.1 plan、invoice、payment link evidence。
6. 复制生成的 `/pay/[invoiceId]` 链接。
7. 在独立钱包环境中打开该链接。
8. 连接付款人钱包。
9. 发送：`I want to pay with USDC on Arbitrum.`
10. 检查 LI.FI quote card。
11. 展开右侧 Timeline，确认有 LI.FI quote/toAmount 和 quote validation evidence。
12. 点击 `Approve & Pay With Wallet`。
13. 如钱包要求，先确认 USDC approve。
14. 确认 LI.FI route transaction。
15. 等待 LI.FI status polling。
16. 生成 receipt / support package。
17. 导出 Run Log JSON。
18. 记录交易 hash、截图和 Run Log，作为 Web3 证明材料。

## 安全边界

- Agent 负责计划和解释，用户钱包负责签名。
- ChainCashier 不托管资金。
- ChainCashier 不持有私钥。
- ChainCashier 不自动花费用户资产。
- 商户地址、目标链、目标 token、收款金额会被锁定在 invoice 中。
- 付款人不能修改商户收款条件。
- 如果 LI.FI quote 的目标地址、目标链或目标 token 和 invoice 不一致，系统会阻止继续支付。
- 如果 quote 或钱包操作失败，Agent 会记录 repair step，并要求用户确认下一步。
- Receipt proof 是支付证据，不是平台担保。

## 关键文件

- `components/ChainCashierChat.tsx`：商户/付款人聊天 UI、流式打字、右侧 Agent Run Timeline、Run Log 导出。
- `lib/chainCashier.ts`：invoice、quote 请求构造、quote 安全校验、receipt/support package。
- `lib/chainCashierChat.ts`：聊天规划辅助、付款来源链解析、run event 输出。
- `lib/chainCashierRun.ts`：Agent Run events 和可导出的 Run Log 结构。
- `lib/chainCashierChains.ts`：支持链、USDC 地址和路线配置。
- `lib/chainCashierStore.ts`：本地 JSON invoice store。
- `lib/wagmi.config.ts`：RainbowKit/Wagmi 多钱包配置和 role-scoped storage。
- `lib/agentConfig.ts` / `lib/agentClient.ts`：GLM-5.1 / Z.AI 模型配置。
- `lib/lifiClient.ts`：LI.FI quote/status client。
- `app/api/chaincashier/chat/route.ts`：SSE 流式聊天 endpoint。
- `app/api/payments/quote/route.ts`：LI.FI `quote/toAmount` wrapper。
- `app/api/payments/status/route.ts`：LI.FI status tracking。
- `app/api/receipts/generate/route.ts`：receipt/support package 生成。

## 验证命令

```bash
node --test
npm run lint
npm run build
```

当前已知情况：

- `npm run lint` 可能仍显示若干既有 warning，但不应有 error。
- `npm run build` 可能显示一个 Turbopack tracing warning，但构建应成功。

## 参赛材料建议

提交前建议准备：

- GitHub repo 和 README。
- 3-5 分钟 demo 视频。
- 一份真实或小额主网测试 Run Log JSON。
- LI.FI quote 截图或导出记录。
- 钱包交易 hash。
- receipt/support package。
- 安全边界说明。
