<p align="right">
  <a href="./README.md">English</a> | 简体中文
</p>

# IntentLens

IntentLens 是一个面向 builder 的 LI.FI Intents 教育 demo。用户用自然语言提出 USDC 跨链目标，系统把它解析成结构化 intent，调用 LI.FI Intents 主网接口获取真实 quote / order preview，并用 Flight Recorder 面板解释 solver、order、settler、oracle 在这次流程里的作用。

MVP 聚焦一条主流链路：

```text
Base USDC -> Arbitrum USDC
```

它不是自营 solver，也不是生产级交易系统。它是 integrator 侧 demo：负责理解用户目标、请求 LI.FI Intents 主网报价、展示真实返回或真实失败原因，并把这次尝试解释给开发者看。

## 展示内容

- 自然语言目标解析
- LI.FI Intents 主网 quote / order preview 接入
- Flight Recorder：逐步展示 Parse Goal、Build Intent、Request Solver Quote、Order Preview、Delivery / Settlement Model
- 与 classic LI.FI route-based flow 的对照
- 主网安全边界：不自动签名、不自动花钱

## 主演示 Prompt

```text
Move 10 USDC from Base to Arbitrum with best received amount
```

旧项目里的 Earn 请求仍然保留，例如：

```text
Find the best USDC vault on Base
```

## 安全边界

IntentLens 使用主网 quote / order-preview 数据。任何真钱交易都必须停在钱包确认，由用户手动决定是否签名。

- 不自动签名
- 不自动提交真钱交易
- 不运营自己的 solver
- 不在没有真实状态返回时声称订单已经 settled

## 启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

复制 `.env.local.example` 为 `.env.local`，至少配置：

```env
DEEPSEEK_API_KEY=
MAIN_AGENT_MODEL=deepseek/deepseek-v4-pro
EARNING_AGENT_MODEL=deepseek/deepseek-v4-pro
NEXT_PUBLIC_WC_PROJECT_ID=
LIFI_API_KEY=
```

`LIFI_API_KEY` 对旧 LI.FI route / Earn API 是可选项。Intents MVP 目标接口是主网 `https://order.li.fi`。

## 关键文件

- `app/api/agents`：流式输出 planner、Earn 和 Intents 事件
- `lib/plannerRuntime.ts`：把自然语言解析成结构化 plan
- `lib/lifiIntents.ts`：构造主网 Intents quote request 和 Flight Record
- `components/IntentFlightRecordCard.tsx`：渲染开发者可读的执行记录
- 原有 LI.FI Earn / route 模块保留为 classic route baseline

## 测试

```bash
node tests/planner-runtime.test.mjs
node tests/agent-config.test.mjs
node tests/lifi-intents.test.mjs
npx tsc --noEmit
npm run build
```
