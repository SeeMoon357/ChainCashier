# ChainCashier 项目交接理解文档

本文给后续接手升级项目的队友使用，目标是快速理解 ChainCashier 现在是什么、怎么跑、核心代码在哪里、当前能力边界是什么，以及后续升级优先级。

## 1. 一句话定位

ChainCashier 是一个面向 Web3 / PayFi 商户的跨链收款 Agent。商户用聊天方式创建 USDC 收款账单，付款人打开独立付款链接后选择来源链并用自己的钱包付款；Agent 负责拆解流程、调用 GLM-5.1 和 LI.FI、校验报价安全性、跟踪支付状态，并生成 receipt / support package。

它不是普通“问答机器人”，而是一个从“自然语言收款需求”到“真实钱包交易、链上哈希、状态追踪、收据生成”的多步骤 Web3 工作流 Demo。

## 2. 当前产品形态

项目目前有两条主要用户路径：

1. 商家端：
   - 入口是 `/`。
   - 商家连接钱包。
   - 商家在聊天框输入类似 `Create an invoice to receive 20 USDC on Base for a Web3 workshop ticket.`
   - GLM-5.1 把自然语言解析为结构化 invoice。
   - 系统锁定商户地址、目标链、目标 token、收款金额、费用策略。
   - 生成 `/pay/[invoiceId]` 独立付款链接。

2. 付款端：
   - 入口是 `/pay/[invoiceId]`。
   - 付款人连接自己的钱包。
   - 付款人用聊天方式选择来源链，例如 `I want to pay with USDC on Arbitrum.`
   - 系统调用 LI.FI `quote/toAmount`，让商家收到目标链上的精确 USDC 金额。
   - 系统校验 LI.FI quote 的目标地址、目标链、目标 token 是否匹配锁定 invoice。
   - 付款人手动 approve / confirm 钱包交易。
   - 系统保存 `sourceTxHash`，轮询 LI.FI status。
   - 完成后生成 receipt / support package。

右侧的 `Agent Run Timeline` 是参赛展示重点之一，用来展示长程任务里的计划、工具调用、校验、钱包确认、状态追踪和最终交付。

## 3. 黑客松适配逻辑

项目面向 Z.AI Web3 x Long-Horizon Task 赛道。

当前可对外解释为：

- GLM-5.1 驱动核心 checkout planning：商户自然语言请求会由 GLM-5.1 解析成结构化 invoice。
- Agent 不只是回答问题，而是完成多步骤 Web3 支付工作流。
- LI.FI quote/status 是真实工具调用，不是 mock。
- 钱包交易由用户手动确认，Agent 不托管资金、不持有私钥、不自动签名。
- Run Timeline / Run Log 展示任务拆解、工具调用、迭代或失败处理、最终 receipt。

建议 Demo 时突出这条叙事：

```text
Agent plans. User signs. Wallet executes. LI.FI routes. App tracks. Receipt proves.
```

## 4. 当前支持的链和路线

当前商户收款目标链：

```text
Base USDC
Arbitrum USDC
```

当前开放付款路线：

```text
Arbitrum -> Base
Optimism -> Base
Polygon -> Base
Base -> Arbitrum
```

路线是配置驱动的。后续如果要开放 `Optimism -> Arbitrum` 或 `Polygon -> Arbitrum`，原则上应优先改路线配置，而不是重构主流程。

相关文件：

- `lib/chainCashierChains.ts`
- `lib/chainCashierChat.ts`
- `lib/chainCashier.ts`

## 5. 技术栈

主要技术：

- Next.js 16
- React 19
- TypeScript
- RainbowKit
- Wagmi
- Viem
- Z.AI GLM-5.1，走 OpenAI-compatible API
- LI.FI `quote/toAmount`
- LI.FI `status`

当前存储：

- 本地：`.chaincashier-data/invoices.json`
- Vercel：临时目录 + 内存兜底

注意：当前存储适合 Demo，不是生产级长期存储。生产化应换成 Redis / Vercel KV / Postgres 等持久化存储。

## 6. 关键目录和文件

### 页面和 API

- `app/page.tsx`
  - 商户端入口。

- `app/pay/[invoiceId]/page.tsx`
  - 付款端入口。

- `app/api/chaincashier/chat/route.ts`
  - ChainCashier 聊天主 API。
  - 使用 SSE 风格流式返回。
  - 商户端会调用 GLM-5.1 解析 invoice。
  - 付款端会调用 LI.FI quote。

- `app/api/invoices/route.ts`
  - invoice 创建 / 最新 invoice 读取。

- `app/api/invoices/[invoiceId]/route.ts`
  - 单个 invoice 查询和 patch。

- `app/api/payments/quote/route.ts`
  - LI.FI quote wrapper。

- `app/api/payments/submit/route.ts`
  - 钱包提交交易后保存 `sourceTxHash`。

- `app/api/payments/status/route.ts`
  - 根据 `sourceTxHash` 调 LI.FI status。
  - 更新 invoice 状态。

- `app/api/receipts/generate/route.ts`
  - 根据 invoice 当前证据生成 receipt / support package。

### 前端组件

- `components/ChainCashierChat.tsx`
  - 目前最核心的 UI 文件。
  - 同时承担商户端和付款端聊天。
  - 包含 typewriter streaming、invoice card、quote card、receipt card、右侧 timeline、Run Log 导出、钱包执行逻辑、付款状态同步。

- `components/WalletConnect.tsx`
  - 钱包连接按钮。

- `components/Providers.tsx`
  - Wagmi / RainbowKit provider。

### 核心业务逻辑

- `lib/chainCashier.ts`
  - invoice 类型、quote 请求构造、quote 安全校验、receipt/support package 生成。

- `lib/chainCashierChat.ts`
  - 商户请求识别、付款来源链解析、聊天规划 chunk、route option 选择。

- `lib/chainCashierChains.ts`
  - ChainCashier 专用链配置、USDC 地址、路线配置。

- `lib/chainCashierRun.ts`
  - Agent Run Event 和 Run Log 结构。

- `lib/chainCashierStore.ts`
  - invoice 临时存储。
  - 本地写 JSON。
  - Vercel 上避免写只读项目目录。

- `lib/chainCashierStreaming.ts`
  - 前端 typewriter 分词逻辑。

- `lib/chainCashierWalletChains.ts`
  - wagmi/viem 钱包执行时的链定义映射。

- `lib/lifiClient.ts`
  - LI.FI quote/status client。

- `lib/agentConfig.ts`
  - agent model 配置。

- `lib/agentClient.ts`
  - 根据配置创建 GLM/Z.AI 等模型 client。

- `lib/wagmi.config.ts`
  - Wagmi/RainbowKit 配置。
  - 商户端和付款端使用 role-scoped wallet storage，降低同一页面状态互相污染。

## 7. 当前环境变量

本地 `.env.local` 至少需要：

```bash
ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
CHECKOUT_AGENT_MODEL=zai/glm-5.1

NEXT_PUBLIC_WC_PROJECT_ID=

# 可选。没有也能调用 LI.FI public endpoint，但可能有 rate limit。
LIFI_API_KEY=
```

项目里还保留了一些旧 agent / IntentLens 相关环境变量，例如：

```bash
MAIN_AGENT_MODEL=
EARNING_AGENT_MODEL=
BRIDGE_AGENT_MODEL=
RISK_AGENT_MODEL=
MONITOR_AGENT_MODEL=
DEEPSEEK_API_KEY=
```

其中 ChainCashier 核心 checkout 流程主要依赖 `ZAI_API_KEY`、`ZAI_BASE_URL`、`CHECKOUT_AGENT_MODEL`、`NEXT_PUBLIC_WC_PROJECT_ID`，LI.FI key 是增强项。

注意：

- `ZAI_BASE_URL` 里的 `/v4` 是 Z.AI API 路径版本，不代表 GLM-4。
- 使用什么模型由 `zai/glm-5.1` 这样的 model name 决定。
- `NEXT_PUBLIC_` 变量会进入浏览器包，不能放秘密。

## 8. 钱包和权限边界

钱包连接使用 RainbowKit + Wagmi。

商户端和付款端有不同的 Wagmi storage key：

```text
merchant: chaincashier.merchant.wagmi
payer:    chaincashier.payer.wagmi
```

这只能降低应用层缓存互相污染，不能改变钱包扩展本身的全局状态。

也就是说：

- 同一个 Chrome profile 里的同一个 MetaMask，账号连接/断开仍然可能相互影响。
- Demo 时建议商户和付款人使用独立环境：
  - Chrome 普通窗口 + 商户钱包
  - Edge / 无痕窗口 / 另一个 Chrome profile / 手机 WalletConnect + 付款人钱包

安全边界：

- Agent 不签名。
- Agent 不托管资金。
- Agent 不持有私钥。
- Agent 只准备交易、解释风险、展示 quote、跟踪状态。
- 资金移动必须由用户在钱包中确认。

## 9. 当前已做的重要近期改动

最近本地有 3 个 commit 还没有 push 到 GitHub，原因是用户要求“不说就只本地提交，别提交 GitHub”。

```text
4feb924 Fix ChainCashier loading indicator overlap
fc5831f Polish ChainCashier checkout chat sync
cb2784c Fix ChainCashier store on Vercel
```

含义：

- `cb2784c`
  - 修复 Vercel 线上不能写 `.chaincashier-data/invoices.json` 的问题。
  - Vercel 上改用临时可写目录，并加内存兜底。

- `fc5831f`
  - 付款端报价消息不再重复显示绿色 invoice 卡。
  - loading 动画动态化。
  - 商家端增加 invoiceId 状态轮询，同步付款端进度和 receipt。

- `4feb924`
  - 修复商家端同时显示 `Thinking...` 和 `streaming` 的 UI 重复问题。

当前状态：

```text
本机代码 ahead origin/master 3 commits
Vercel 曾经部署过 cb2784c
后两个 UI 改动是否已经部署，取决于后续是否重新 vercel deploy
```

如果队友从 GitHub clone 项目，需要先确认这 3 个本地 commit 是否已经 push。

## 10. Vercel 部署状态和注意事项

当前生产 Demo 地址：

```text
https://chaincashier.vercel.app
```

项目在 Vercel CLI 下已经能 production deploy。

但之前 GitHub 自动部署连接失败过，可能需要在 Vercel Dashboard 重新授权 GitHub 仓库：

```text
https://vercel.com/seemoon357s-projects/chaincashier/settings/git
```

环境变量页面：

```text
https://vercel.com/seemoon357s-projects/chaincashier/settings/environment-variables
```

部署注意：

- Production 环境变量已有 Z.AI / model / WalletConnect 等关键变量。
- 之前检查时 Production 缺 `LIFI_API_KEY`，但 LI.FI public endpoint 仍可用，只是可能受 rate limit 影响。
- Preview 环境变量之前为空，如果需要 Preview deployment，必须单独配置。

## 11. 本地运行和验证命令

安装和启动：

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

验证：

```bash
node --test
npm run lint
npm run build
```

当前已知：

- `npm run lint` 会有一些旧 warning，主要是未使用变量，不是本次 ChainCashier 核心逻辑错误。
- `npm run build` 应该成功。

## 12. 典型 Demo 脚本

建议用很小金额真实主网资金。

商户端：

```text
Create an invoice to receive 0.1 USDC on Base for a Web3 workshop ticket.
```

或收 Arbitrum：

```text
Create an invoice to receive 0.1 USDC on Arbitrum for a Web3 workshop ticket.
```

付款端：

```text
I want to pay with USDC on Arbitrum.
```

或：

```text
I want to pay with USDC on Base.
```

Demo 时观察：

- 商户聊天是否生成 invoice。
- 右侧 timeline 是否出现 plan / invoice / link。
- 付款链接是否独立打开。
- 付款端是否显示 invoice 欢迎消息。
- 付款端选择来源链后是否出现 LI.FI quote card。
- quote card 是否显示 route tool、estimated time、payer cost、fee。
- 钱包是否要求 approve / pay。
- 提交后是否显示 `sourceTxHash`。
- LI.FI status 是否轮询到 completed。
- receipt/support package 是否生成。
- 商户端是否同步付款完成状态。

## 13. 当前已知边界和风险

### 13.1 存储不是生产级

当前 invoice store 主要是 Demo 存储：

- 本地写 JSON。
- Vercel 写临时目录和内存兜底。

风险：

- Vercel serverless 实例冷启动或切换后，历史 invoice 可能丢。
- 多实例并发下，内存态不共享。

生产升级建议：

- 接 Vercel KV / Upstash Redis / Postgres。
- invoice、quote、sourceTxHash、receipt 都应持久化。

### 13.2 商户端同步依赖同一个后端存储

商户端轮询 `/api/payments/status?invoiceId=...` 来同步付款进度。

如果 invoice 在后端丢失，商户端无法同步。

所以商户端同步问题的长期解法仍然是持久化存储。

### 13.3 GLM 使用是结构化生成，不是完整自治框架

当前 GLM-5.1 主要负责：

- 商户自然语言 invoice 解析。
- 作为 checkout planning agent 的核心模型。

流程编排、安全校验、LI.FI 调用、钱包执行边界主要由代码实现。

参赛讲述时应诚实表达：

- GLM-5.1 驱动意图理解和计划生成。
- 工具执行和安全边界由系统编排保障。
- Run Timeline 把模型、工具、钱包、状态追踪串成完整长程工作流。

### 13.4 多钱包不是同浏览器同扩展的完全隔离

RainbowKit 可以展示多个钱包品牌。

但同一个浏览器 profile 下的同一个 MetaMask 扩展仍然共享全局状态。

Demo 时要用独立环境。

### 13.5 只支持 USDC

当前产品刻意只做 USDC，减少 quote、精度、安全校验复杂度。

后续支持多 token 需要重做：

- token registry
- decimals
- quote validation
- UI 文案
- receipt schema

## 14. 推荐升级优先级

### P0：先保证可演示稳定

1. 把本地 ahead 的 3 个 commit push 到 GitHub，或让队友直接基于本机代码继续。
2. 重新部署 Vercel，让线上包含最新 UI/商户同步修复。
3. 补齐 Vercel Production 的 `LIFI_API_KEY`，降低 rate limit 风险。
4. 配好 GitHub 自动部署。

### P1：换生产级存储

建议优先接一个持久化存储：

- Vercel KV / Upstash Redis：改动较轻，适合 hackathon。
- Postgres：更正式，适合后续生产。

需要持久化的数据：

- invoice
- quote summary
- source chain
- payer address
- source tx hash
- destination tx hash
- LI.FI status/substatus
- receipt/support package
- run events

### P2：把 Run Log 做成更完整的参赛证据

当前 Run Log 已能导出，但可继续增强：

- 加入 quote request summary。
- 加入 quote validation details。
- 加入 source/destination scan links。
- 加入 receipt hash。
- 加入失败修复记录。
- 加入模型调用位置说明。

### P3：增强 Agent 长程感

可以让 GLM-5.1 参与更多计划和修复环节：

- quote 失败后让 Agent 总结原因并建议替代来源链。
- 钱包错误后让 Agent 解释错误并给出下一步。
- 根据 LI.FI status 不同 substatus 给出不同提示。
- 生成最终 human-readable receipt report。

### P4：产品体验优化

- 中文文案全面清理，避免 README 或 UI 出现编码问题。
- 支付完成后展示 scan 链接。
- 商户端显示收款确认摘要。
- 付款端 receipt card 更友好，不只展示 JSON。
- 移动端布局优化。

## 15. 队友接手前建议确认的问题

队友升级前建议先确认：

1. 是基于本机代码继续，还是基于 GitHub 远端继续？
2. 本地 ahead 的 3 个 commit 是否已经 push？
3. Vercel 是否要重新部署最新代码？
4. 是否要先接数据库/KV？
5. 升级重点是参赛演示、生产稳定、还是产品体验？
6. 是否继续只做 USDC？
7. 是否继续只开放当前四条路线？

## 16. 最短接手路线

如果队友只想最快跑起来：

```bash
git clone https://github.com/SeeMoon357/ChainCashier.git
cd ChainCashier
npm install
```

然后配置 `.env.local`：

```bash
ZAI_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
CHECKOUT_AGENT_MODEL=zai/glm-5.1
NEXT_PUBLIC_WC_PROJECT_ID=...
LIFI_API_KEY=...
```

启动：

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

但如果 GitHub 还没包含本机最新 3 个 commit，队友需要先拿到本机最新代码，否则会缺少 Vercel store 修复、商户同步优化和 loading 重复修复。
