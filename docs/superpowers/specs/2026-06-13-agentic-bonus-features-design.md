# ChainCashier 加分项设计文档：长程 Agentic 层

- 日期：2026-06-13
- 目标赛道：Z.AI Web3 × Long-Horizon Task
- 范围：在不修改 ChainCashier 现有主流程的前提下，新增三组加分能力
- 选定方向：① 长程自愈 Checkout Planner、③ 风险评分 + 链上对账收据 Agent、④ 参赛证据增强
- 未选方向：② 复活 Earn Agent（本轮不做，作为后续可选项）

> 本文档为设计稿，尚未进入实现。函数/类型名来自 `CLAUDE.md`、`PROJECT_HANDOFF.zh-CN.md` 与已读文件（`agentConfig.ts`、`app/api/chaincashier/agent/route.ts`、`agentSteps.ts`）。**精确签名以实现时核实源码为准**，详见第 12 节"前提与待核实"。

---

## 1. 背景与目标

当前 ChainCashier 的最大短板，恰好是 Z.AI 赛道的第一条评审标准。`PROJECT_HANDOFF.zh-CN.md` 13.3 节自己承认：**GLM-5.1 目前只做一次结构化生成（`generateObject`）**，流程编排、安全校验、LI.FI 调用、钱包边界都由确定性代码实现。而赛道评审重点是"GLM-5.1 驱动的长程、自主、自我纠错"。

本设计的核心目标：把 GLM-5.1 从"一次解析"升级成**看得见的多步工具调用 + 自我纠错**，并产出赛题硬性要求的"长程任务运行记录"证据件——全部以纯增量方式落地。

---

## 2. 评分映射

| 评审侧重点 | 当前现状 | 本设计的应对 |
|---|---|---|
| GLM-5.1 使用关键性（自主规划/持续执行/自我纠错） | 仅一次 `generateObject` | ① planner 多步 tool-calling 循环 + 失败自纠；③ 风险判定与失败诊断叙事 |
| 任务复杂度与闭环（理解→计划→执行→验证→修复→交付） | 商户解析→报价→付款→receipt 基本闭环，但 agent 参与薄 | ① 补"计划+迭代+修复"；③ 补"验证+修复叙事"；④ 把全链路串成可追溯记录 |
| 长程稳定性（多步多工具、目标一致） | 单步 | ① 多轮工具调用 + 预算/轮次上限保证不跑偏 |
| 可演示性/可复现性 | 有 Run Timeline + 可导出 Run Log | ④ 升级为结构化"长程任务运行记录"，含模型调用点、工具 I/O、scan 链接、修复记录 |
| 安全/成本/权限边界 | 已有（不签名/不托管/不持私钥） | 全部新增能力保持只读与建议性，复用既有安全边界（见第 7 节） |

---

## 3. 总体架构与"不修改原项目"边界

### 3.1 增量原则

三组能力全部以**新增文件**落地：

- 新增纯逻辑模块 `lib/*.ts`（保持单元可测，遵守项目的 `.mjs` 测试约定）。
- 新增 Route Handler `app/api/**/route.ts`（薄包装，`runtime = 'nodejs'`）。
- 新增 UI 入口（页面或小组件），尽量避免改动 `components/ChainCashierChat.tsx`。

**只读复用**现有纯函数与配置（调用但不改）：

- 链/路线解析：`lib/chainCashierChains.ts`（USDC 地址、`CHAINCASHIER_PAYMENT_ROUTES`、6 decimals）。
- 报价构造与安全校验：`lib/chainCashier.ts`（报价请求构造、`summarizePaymentQuote` 的锁定项校验、`createInvoiceFromAgentOutput`、receipt/support package 与哈希）。
- 聊天规划与回退：`lib/chainCashierChat.ts`（商户意图识别、付款来源链解析、回退助手）。
- Run 事件：`lib/chainCashierRun.ts`（RunEvent/RunLog 结构，驱动右侧 Payment Flow Recorder）。
- LI.FI 客户端：`lib/lifiClient.ts`（`quote`、`quote/toAmount`、`status`、earn vault）。
- Agent 配置/客户端：`lib/agentConfig.ts`、`lib/agentClient.ts`（`getAgentConfig`、`getModelFromConfig`）。

### 3.2 不可触碰的红线（与 `CLAUDE.md` 一致）

- 锁定项安全不变：`summarizePaymentQuote` 对目标地址/链/token 不匹配**抛错**，绝不放松。
- 资金路径不变：新增能力**不签名、不托管、不持私钥、不自动移动资金**。钱包确认仍是唯一动款闸门。
- 不在付款路径或价值转移逻辑里加 LLM 调用（① 只创建 invoice 记录；③ 全部只读 + 建议性）。

### 3.3 GLM-5.1 接入方式

复用 `getAgentConfig('<slot>')` + `<NAME>_AGENT_MODEL` 覆盖机制，把新增 agent 槽默认指向 GLM-5.1：

- 新增槽 `planner`（功能①），默认 `zai/glm-5.1`。
- 复用现有槽 `risk`、`monitor`（功能③），通过 `RISK_AGENT_MODEL=zai/glm-5.1` / `MONITOR_AGENT_MODEL=zai/glm-5.1` 切到 GLM-5.1。
- 模型客户端经 `lib/agentClient.ts` 的 `createOpenAI`（Z.AI OpenAI-compatible）构造，tool-calling 用 AI SDK 的 `streamText` + `tools`（**待核实** Z.AI 端点对 function calling 的支持，见第 12 节）。

### 3.4 与现有 Run Timeline 的关系

三组能力都把步骤写入**同一个 RunLog / run_event 流**，由现有 Payment Flow Recorder 渲染。功能④再把这份 RunLog 导出为参赛证据件。这样长程过程在 Demo 里"一处可见、一键导出"。

---

## 4. 功能① 长程自愈 Checkout Planner

### 4.1 目标

让 GLM-5.1 以 tool-calling 自主完成收款 invoice 的"理解→计划→询价→评估→自纠→锁定"闭环，过程实时进入 Run Timeline。

### 4.2 新增文件

- `lib/agenticPlan.ts`（纯）：
  - 工具结果的结构化类型、步骤→RunEvent 的映射、自纠策略（重试上限、备用来源链排序、预算守卫）。
  - 来源链按成本/速度排序的纯函数（输入：多个候选报价摘要；输出：排序 + 推荐理由）。
  - 自纠判据：`shouldRetry(error/cost)` —— 报价失败、费用超阈值、校验不匹配时的处置。
- `app/api/chaincashier/agent-plan/route.ts`（SSE，`runtime='nodejs'`）：
  - `streamText({ model: GLM-5.1, tools, maxSteps })` 驱动多步循环。
  - 每个工具调用前后 emit 现有 `run_event` chunk（步骤写进 `run_event`，工具 I/O 写进其 `data`），避免新增顶层 chunk 类型（见 4.5）。
  - 终态 emit `invoice`（复用 `createInvoiceFromAgentOutput`）+ `response`（人类可读计划/理由）+ `done`。

### 4.3 工具集（GLM-5.1 可调用）

- `getSupportedRoutes({ settlementChain })` → 返回该结算链允许的来源链（只读 `CHAINCASHIER_PAYMENT_ROUTES`）。
- `estimateQuote({ settlementChain, sourceChain, amount })` → 用现有报价请求构造 + `lifiClient /quote/toAmount`，返回付款人成本/费用/预计时间/路由跳数；**经 `summarizePaymentQuote` 校验**，校验失败时工具返回结构化错误供模型反应（不向外抛）。
- `lockInvoice({ settlementChain, amount, memo, feePolicy })` → 调 `createInvoiceFromAgentOutput`，返回 `invoiceId` + `/pay/[invoiceId]` 链接。
- `finishPlan({ chosenSourceChain, rationale, plan[] })` → 终止。

### 4.4 自我纠错场景（Demo 可演示）

- 最优路线费用过高（相对金额）→ 模型改选更便宜来源链重询。
- LI.FI 限流/网络错误 → 退避重试，再退而至备用来源链。
- 金额缺失/歧义 → 模型产出 `missingFields`，向商户追问而非硬猜。
- 校验不匹配（防御性，正常不应触发）→ 安全停止并在证据里记为失败/修复记录。

### 4.5 与现有 chunk 协议的关系

- **不新增顶层 `ChainCashierChatChunk` 类型**。工具调用粒度通过现有 `run_event` 表达：步骤标题/状态走 RunEvent 标准字段，工具入参出参放进 `run_event.data`。
- 这样 `lib/chainCashierStreaming.ts` 与 `components/ChainCashierChat.tsx` 的渲染逻辑**无需改动**即可显示。
- UI 入口建议用**新页面 `/plan`**（自带轻量 timeline，或抽取一个共享 `<RunTimeline>` 组件），避免改动 `ChainCashierChat.tsx`。

### 4.6 安全

planner 只创建 invoice 记录，不触碰付款路径；`lockInvoice` 等价于今天的 invoice 创建；锁定项校验只读复用。

---

## 5. 功能③ 风险评分 + 链上对账收据 Agent

### 5.1 子能力 A：付款前风险评分（`risk` 槽）

- `lib/riskAgent.ts`（纯）：
  - 输入：已校验报价摘要（费用、gas 成本 USD、路由跳数、滑点/toAmount、涉及桥、预计时间）。
  - 输出（`generateObject` + zod）：`{ level: 'low'|'medium'|'high', score: 0-100, factors: [], recommendation: string, warnings: [] }`。
  - 确定性回退：GLM 不可用时按"费用占比 + 跳数 + 时间"启发式算分，仍返回同结构（不强依赖）。
- `app/api/chaincashier/risk/route.ts`：`POST { invoiceId, quoteSummary }` → 判定。付款端在钱包确认前展示（新增"风险检查"卡，纯建议性，不阻断）。

### 5.2 子能力 B：付款后链上对账 + 收据叙事（`monitor` 槽）

- `lib/reconcileAgent.ts`（纯）：
  - (a) **链上核验（只读）**：用 viem public client 读目标链上到商户锁定地址、锁定金额的 USDC 转账，确认到账与锁定项一致；返回 `{ verified, dstTxHash, block, amountSeen }`。
  - (b) **GLM-5.1 叙事**：生成人类可读 receipt 叙事，覆盖全流程；并对非终态 LI.FI substatus（卡住/失败）做**诊断 + 下一步建议**（自我纠错式解释，不自动重试动款）。
- `app/api/chaincashier/reconcile/route.ts`：`POST { invoiceId }` → `{ verified, narrative, evidence, receiptHash }`。
- receipt 哈希：只读复用现有 receipt 哈希逻辑，使叙事绑定同一防篡改件；若现有模块未导出独立哈希器，在**新文件**里加一个薄纯函数包装（不改原文件）。

### 5.3 安全

- 对账只读链状态，不签名、不自动移动资金。
- 锁定项二次核验（纵深防御）：到账证据与锁定 invoice 不符 → `verified=false`，叙事标注"结算不符，需人工复核"。
- 风险分纯建议性，不阻断付款。

---

## 6. 功能④ 参赛证据增强（"长程任务运行记录"导出）

### 6.1 目标

把 RunLog 升级为赛题硬性提交项：标注每次模型调用位置、工具 I/O、锁定项快照、报价校验细节、状态轮询时间线、receipt 哈希 + 核验结果、失败/修复记录、scan 链接。

### 6.2 新增文件

- `lib/runEvidence.ts`（纯）：
  - 输入：RunLog（+ 可选 invoice/quote/receipt 摘要）。
  - 输出 `ChainCashierEvidence` 文档，含分节：任务概要、agent 模型 + 调用点、工具调用 I/O、锁定项快照、报价校验、状态时间线、receipt 哈希 + 核验、失败/修复记录、scan 链接（按链构造 source/destination 探浏览器 URL，只读链配置）。
  - 模型调用图：列出每次 GLM-5.1 调用（用途 + 工具轮次计数）。
- 导出格式：JSON（机读，权威件）+ Markdown（人读，贴 README/Demo）。
- `app/api/chaincashier/evidence/route.ts`：`GET ?invoiceId=&format=json|md` → 证据件。

### 6.3 与 ①③ 的协同

①③ 的步骤都写进同一 RunLog，④ 导出时一并捕获 planner + 风险 + 对账的完整长程轨迹，形成统一的"长程任务运行记录"。

### 6.4 UI

时间线上加"导出长程任务记录"按钮（新增小组件挂载，或沿用现有导出缝隙；handoff 提到 Run Log 已可导出）。这是三组能力里**唯一可能需要轻微 UI 接线**之处，单独标注、最小化处理。

---

## 7. 安全 / 成本 / 权限边界

- 不签名、不托管、不持私钥、不自动移动资金——不变。
- ① 只创建 invoice 记录，付款路径不变。
- ③ 风险=建议性，对账=只读 + 建议；不符即"人工复核"，绝不自动处置。
- 失败处理：LI.FI 错误→退避重试→备用来源链→安全停止并提示；GLM 不可用→确定性回退（沿用现有 chat 路由回退模式）。
- 成本控制：planner 工具轮次上限（如 ≤6）、单 agent token 上限、可选预算守卫；证据件里标注 GLM 调用成本。
- 人工介入闸门：钱包确认为唯一动款步骤，保持不变。

---

## 8. 错误处理

- LI.FI 网络/限流：planner 工具内退避重试 → 备用来源链 → 安全停止 + 消息。
- GLM 不可用：① 确定性 invoice 回退；③ 启发式风险分 / 模板化叙事；④ 仍可基于纯结构导出（不依赖 GLM）。
- 校验不匹配：硬停止，在证据件记为失败/修复记录。
- 对账链上读取失败：标记 `unverified`，叙事说明"无法核验，需人工复核"。

---

## 9. 测试策略

- 所有新增纯模块写 `tests/*.test.mjs`（node:test + 现有 loader，只测纯 lib/）：
  - `tests/agenticPlan.test.mjs`：来源链排序、自纠判据、工具结果塑形、轮次上限。
  - `tests/riskAgent.test.mjs`：启发式评分、判定 schema 校验。
  - `tests/reconcileAgent.test.mjs`：给定 fixture 转账 vs 锁定 invoice 的核验通过/失败。
  - `tests/runEvidence.test.mjs`：给定 fixture RunLog，断言各分节、receipt 哈希包含、scan 链接正确、修复记录提取。
- 网络/链/GLM 部分保持薄；用 fixture/mock 或开发期手测。
- React 组件与 Route Handler 不可单测（依项目测试约束）——逻辑全放纯 `lib/*.ts`。

---

## 10. 实现顺序与依赖

建议顺序（每步可独立交付、可独立 Demo）：

1. **④ 脚手架先行**：`runEvidence.ts` + evidence 路由（JSON/MD）。快速产出，并先定下 run_event 词汇，供 ①③ 遵循。
2. **① planner**：`agenticPlan.ts` + `/agent-plan` 路由 + `/plan` 页面。最大 GLM 长程亮点。
3. **③ 风险 + 对账**：`riskAgent.ts`、`reconcileAgent.ts` + 两个路由 + 付款端风险卡。
4. **④ 充实**：补模型调用图、scan 链接、修复记录聚合（此时 ①③ 已产生丰富 run_event）。

---

## 11. 待确认的设计决策

1. **① 的 UI 形态**：新页面 `/plan`（推荐，零改 `ChainCashierChat.tsx`）vs 在现有 chat 加 mode 切换。
2. **planner agent 槽**：新增 `planner` 槽（推荐，职责清晰）vs 复用 `checkout`。
3. **timeline 复用方式**：抽取共享 `<RunTimeline>` 组件（轻度重构）vs `/plan` 页面自带轻量 timeline（更隔离）。
4. **对账 RPC**：用现有 `lib/wagmi.config.ts` / `chainCashierWalletChains.ts` 的只读 public client（待核实可用性）。
5. **④ 导出按钮落点**：新增小组件挂载 vs 沿用现有导出缝隙（需核实 ChainCashierChat 现有导出实现）。

---

## 12. 前提与待核实事项（诚实声明）

本设计在跳过深度源码提取的前提下编写，以下需在实现前**逐一核实**：

- `lib/chainCashier.ts` 中：报价请求构造函数、`summarizePaymentQuote`（签名 + 抛错条件与错误类型）、`createInvoiceFromAgentOutput`（入参/锁定字段/返回）、receipt/support package 生成与**哈希算法 + 参与字段**的精确形态。
- `lib/chainCashierChains.ts` 中：`CHAINCASHIER_PAYMENT_ROUTES` 的精确结构、按结算链列来源链的 helper（若有）、链名→id/config 解析函数（签名 + 抛错）。
- `lib/chainCashierRun.ts` 中：RunEvent / RunLog 的精确类型与构建/追加函数签名、现有导出格式。
- `app/api/chaincashier/chat/route.ts` 中：`ChainCashierChatChunk` 各变体字段、SSE 发射顺序。
- `lib/lifiClient.ts` 中：`quote`/`quote/toAmount`/`status`/earn vault 方法签名与入出参。
- **Z.AI OpenAI-compatible 端点对 function calling（`tools`/`tool_choice`）的支持情况**——① 的 tool-calling 循环依赖于此；若不支持，退化为"GLM 产出计划 JSON + 代码按计划逐步执行工具"的半自治形态（仍可展示多步与自纠，但模型不直接发工具调用）。
- `lib/agentClient.ts` 的 `getModelFromConfig` 是否可直接用于 `streamText`。
- 现有 ChainCashierChat 的 Run Log 导出实现（④ 是否能零改复用）。

实现第一步将先核实上述签名，再动工；如有关键项（尤其 Z.AI tool-calling 支持）不成立，回退方案见上。

---

## 13. 新增文件清单

```
lib/agenticPlan.ts                 # ① 纯：工具结果类型/自纠策略/排序
lib/riskAgent.ts                   # ③ 纯：风险评分 + 启发式回退
lib/reconcileAgent.ts              # ③ 纯：链上核验匹配 + 叙事数据准备
lib/runEvidence.ts                 # ④ 纯：RunLog → 证据件(JSON/MD)
app/api/chaincashier/agent-plan/route.ts   # ① SSE：planner 多步循环
app/api/chaincashier/risk/route.ts         # ③ 风险判定
app/api/chaincashier/reconcile/route.ts    # ③ 对账 + 叙事
app/api/chaincashier/evidence/route.ts     # ④ 证据导出
app/plan/page.tsx (或 app/plan/route)      # ① UI 入口(新页面)
components/...（最小化：风险卡 / 导出按钮 / timeline,视第 11 节决策）
tests/agenticPlan.test.mjs
tests/riskAgent.test.mjs
tests/reconcileAgent.test.mjs
tests/runEvidence.test.mjs
```

不改动：`lib/chainCashier*.ts`（除只读调用）、`app/api/chaincashier/chat/route.ts`、`components/ChainCashierChat.tsx`（目标上零改或最小化）、锁定项校验与价值转移路径。
