<p align="right">
  <a href="./README.md">English</a> | 中文
</p>

# ChainCashier

由 GLM-5.1 驱动的 Web3 / PayFi 长程跨链收银 Agent。

- **在线 Demo**：[chaincashier.vercel.app](https://chaincashier.vercel.app/)
- **Pitch 展示页**：[chaincashier.vercel.app/pitch](https://chaincashier.vercel.app/pitch)
- **Demo 视频**：首页视频卡片可直接播放
- **参赛赛道**：Z.AI Web3 x Long-Horizon Task

## 项目简介

ChainCashier 让商家用聊天创建锁定的 USDC 收款账单。付款人打开独立 checkout 聊天页后，可以选择支持的来源链，并用自己的钱包确认交易；商家最终在 Base 或 Arbitrum 收到目标金额。

Agent 会规划任务流程、调用 LI.FI 报价和状态工具、校验每条路线是否匹配锁定账单、解释费用和安全边界、追踪付款状态，并生成可验证的 receipt 支持材料。

## 黑客松匹配度

ChainCashier 面向 Z.AI Web3 x Long-Horizon Task 赛道：

- **GLM-5.1 作为 Agent 大脑**：商家端和付款端的核心决策由 GLM-5.1 通过 Z.AI OpenAI-compatible API 驱动。
- **长程工作流**：Demo 不是一次性 API 调用，而是覆盖意图解析、账单创建、付款链接、来源链选择、LI.FI 报价、报价校验、钱包确认、状态轮询、收据生成和 Run Log 导出。
- **工具调用与迭代**：Agent 调用真实支付工具，把每一步记录到 Agent Run Timeline；当路线、钱包操作或状态查询失败时，会要求用户调整后继续。
- **Web3 证明**：成功运行后可以展示交易 hash、scan 链接、LI.FI 状态、receipt JSON 和 support package。
- **安全边界**：Agent 不签名、不保存私钥、不托管资金，真实执行永远由用户钱包完成。

## 核心流程

1. 商家打开 `/` 或 `/chat`，描述收款需求。
2. GLM-5.1 解析金额、收款链、token、用途和费用策略。
3. ChainCashier 将商家地址、目标链、目标 token 和目标金额锁定到 invoice。
4. 应用生成 `/pay/[invoiceId]` checkout 链接。
5. 付款人在独立浏览器、独立钱包 profile 或 WalletConnect 钱包中打开链接。
6. 付款人在聊天中选择来源链。
7. 应用调用 LI.FI `quote/toAmount`，确保商家收到目标链上的精确金额。
8. ChainCashier 校验 quote 的目标地址、链、token 和金额是否匹配锁定 invoice。
9. 付款人在钱包中确认授权和付款。
10. 应用保存 `sourceTxHash`，轮询 LI.FI 状态，并记录执行时间线。
11. 路线完成后，ChainCashier 生成 receipt 和 support package。

## 支持路线

商家收款目标链：

```text
Base USDC
Arbitrum USDC
```

当前开放的付款路线：

```text
Arbitrum -> Base
Optimism -> Base
Polygon -> Base
Base -> Arbitrum
```

路线矩阵是配置驱动的。后续如果要开放 `Optimism -> Arbitrum` 或 `Polygon -> Arbitrum`，可以扩展配置，不需要重写主流程。

## 技术栈

- Next.js 16、React 19、TypeScript
- RainbowKit、Wagmi、Viem
- Z.AI GLM-5.1 OpenAI-compatible API
- LI.FI `quote/toAmount` 和 `status`
- 本地 JSON invoice store，用于黑客松 demo

## 本地配置

在项目根目录创建 `.env.local`：

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4

# 可选模型覆盖项。默认核心 ChainCashier agents 使用 zai/glm-5.1。
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

- `ZAI_BASE_URL=https://api.z.ai/api/paas/v4` 里的 `v4` 是 API 版本路径，不代表 GLM-4；实际模型由 `glm-5.1` 决定。
- `NEXT_PUBLIC_WC_PROJECT_ID` 用于 RainbowKit / WalletConnect 展示多品牌钱包。没有它时，通常只能看到浏览器 injected 钱包。

安装并启动：

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## Demo 流程

只建议使用很小金额的真实主网资金。

1. 打开 `/` 并进入商家聊天页。
2. 连接商家钱包。
3. 发送：`Create an invoice to receive 1 USDC on Base for a live test.`
4. 复制生成的 `/pay/[invoiceId]` 链接。
5. 在独立的付款钱包环境中打开该链接。
6. 发送：`I want to pay with USDC on Arbitrum.`
7. 检查 LI.FI quote card 和 Agent Run Timeline。
8. 点击 `Approve & Pay With Wallet`。
9. 在钱包中确认授权和付款。
10. 等待 LI.FI 状态轮询完成。
11. 导出 Run Log 和 receipt package。

## 钱包边界

商家端和付款端使用不同的 Wagmi storage key：

```text
merchant: chaincashier.merchant.wagmi
payer:    chaincashier.payer.wagmi
```

这可以降低应用层钱包缓存互相污染。账单创建后，checkout 页面会从 invoice 读取已经锁定的商家收款地址，因此不要求商家钱包持续在线。

但这不能改变钱包扩展自身的全局状态。同一个 Chrome profile 里的同一个 MetaMask 扩展，账号连接和断开仍然是全局的。真实演示时，建议付款端使用独立浏览器 profile、无痕窗口、Edge、手机 WalletConnect 钱包，或其他独立钱包环境。

## 安全边界

- Agent 负责规划，用户负责签名，钱包负责执行，LI.FI 负责路由，应用负责追踪，receipt 负责证明。
- ChainCashier 不托管资金。
- ChainCashier 不保存私钥。
- ChainCashier 不自动花费用户资产。
- 商家地址、目标链、目标 token 和收款金额会锁定在 invoice 中。
- 付款人不能修改商家收款条件。
- 如果 LI.FI quote 的目标地址、链、token 或金额与锁定 invoice 不匹配，系统会阻止继续支付。
- Receipt proof 是支付证据，不是平台结算担保。

## 关键文件

- `components/LandingHero.tsx`：首页和黑客松展示内容。
- `components/DemoVideoCard.tsx`：首页 demo 视频弹窗。
- `components/ChainCashierChat.tsx`：商家和付款人聊天 UI、打字效果、Agent Run Timeline、Run Log 导出。
- `lib/chainCashier.ts`：invoice 模型、quote 请求构造、quote 安全校验、receipt package。
- `lib/chainCashierChains.ts`：支持链、USDC 地址和路线矩阵。
- `lib/chainCashierRun.ts`：Agent Run events 和可导出的 Run Log 结构。
- `lib/agentConfig.ts` 和 `lib/agentClient.ts`：GLM-5.1 / Z.AI 配置。
- `lib/lifiClient.ts`：LI.FI quote 和 status client。
- `app/api/chaincashier/chat/route.ts`：流式聊天 endpoint。
- `app/api/payments/quote/route.ts`：LI.FI quote wrapper。
- `app/api/payments/status/route.ts`：LI.FI status tracking。
- `app/api/receipts/generate/route.ts`：receipt/support package 生成。
- `app/pitch/route.ts` 和 `public/pitch/`：静态 Pitch Deck。
- `public/demo/chaincashier-demo.mp4`：2 分钟 demo 视频。

## 验证命令

```bash
node --test
npm run lint
npm run build
```

`npm run lint` 可能仍有已有 warning，但不应该有 error。`npm run build` 可能显示 Turbopack tracing warning，但构建应成功。

## 参赛材料建议

建议提交前准备：

- GitHub repo 和 README
- Vercel 在线 demo 链接
- `/pitch` 展示页
- 2 分钟 demo 视频
- 真实或小额主网测试 Run Log JSON
- 钱包交易 hash 和 scan 链接
- Receipt/support package
- 安全边界说明
