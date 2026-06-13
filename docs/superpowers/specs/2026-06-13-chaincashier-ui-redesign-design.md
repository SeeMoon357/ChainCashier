# ChainCashier 前端重设计:应用 zip 的 AI Studio 风格

- **日期**: 2026-06-13
- **状态**: 设计已确认(brainstorming 通过),待实现计划
- **设计来源**: `zip/`(Vite + React 的 AI Studio 风格原型)

## 1. 背景与目标

当前 ChainCashier 前端视觉碎片化、偏朴素:收款聊天页是绿/emerald + slate 直角卡片,`app/agent` 走 Ant Design X 默认风,home 那套又是金色 + 莲花艺术。三套界面风格各异且都偏"工具感"。

**目标**:统一替换为 `zip/` 提供的 AI Studio 风格——近白底(`#FDFDFD`)+ 有机模糊渐变球背景 + `glass-island` 毛玻璃岛屿 + 胶囊形(pill)+ `Plus Jakarta Sans` / `Source Serif 4` 字体 + motion 入场动效。**连布局一起重排**,贴近 zip 原版范式,而非仅换色。

## 2. 活跃范围(经代码 grep 确认)

`HomeShell`、`components/home/views/*`(10 个 dashboard 视图)、`ChainCashierDemo.tsx` 在整个代码库中**零引用**,是死代码,用户看不到。本次**不动**。

真正活跃的只有 **2 个核心组件 / 3 个路由**:

| 路由 | 组件 | 说明 |
|---|---|---|
| `app/page.tsx` | `ChainCashierChat`(role=merchant) | 商户收款聊天页 |
| `app/pay/[invoiceId]/page.tsx` | `ChainCashierChat`(role=payer) | 付款方结算聊天页 |
| `app/agent/page.tsx` | `Sidebar` + `ChatContent` | IntentLens agent 对话页(Ant Design X) |

## 3. 关键决策(brainstorming 确认)

- **范围**:仅 2 个活跃界面(死代码不动)。
- **程度**:连布局一起重排,贴近 zip 原版(顶部玻璃导航 / 浮动胶囊输入 / landing 风格首屏)。
- **方式**:统一设计系统 + 分阶段——先建令牌与共享基元,再逐页迁移。根治碎片化,避免越改越乱。

## 4. 设计令牌与共享 UI 基元(第 1 层 · 地基)

建好后两个界面复用。改写 `app/globals.css` 的 `@theme`,替换现有绿/金主题。

### 4.1 设计令牌

| 项 | 新值(zip 风格) |
|---|---|
| `--font-sans` | `"Plus Jakarta Sans", ui-sans-serif, system-ui, ...`(项目 `@import` 已引入,复用) |
| `--font-serif` | `"Source Serif 4", ui-serif, Georgia, ...`(新增 `@import`) |
| 底色 | 根容器 `#FDFDFD` |
| 文字 | `#1F1F1F` / 标题 `#1a1c1c` |
| 主强调色 | 蓝 `#3B82F6`(取代 emerald / accent-gold) |
| `--shadow-ambient` | `0 12px 48px rgba(59, 130, 246, 0.08)` |
| `--shadow-glass` | `0 4px 32px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.6)` |
| `--shadow-pill` | `0 2px 12px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.05)` |
| 工具类 `.glass-island` | `bg-white/70 backdrop-blur-2xl border border-white/60 shadow-glass` |
| 工具类 `.animate-pulse-slow` | 呼吸光动画(`pulse 4s infinite`) |
| 背景层 | 有机模糊渐变球:`orange-50/50` + `blue-50/50`,`blur-[100px]`,`mix-blend-multiply` |

### 4.2 共享 UI 基元(新建 `components/ui/`)

- `<BackgroundBlobs>` — 两颗有机渐变球背景层(绝对定位、`pointer-events-none`)。
- `<GlassIsland>` — 毛玻璃容器,作导航条 / 卡片 / 输入框外壳的统一基底。
- `<PillComposer>` — 底部浮动胶囊输入框(麦克风 + 输入 + 发送),zip `ChatPage` 同款;对接 props:`value` / `onChangeAction` / `onSubmitAction` / `loading` / `onCancelAction`。
- `<GradientButton>` — 渐变胶囊按钮(zip「Get Started」风格)。
- `<SerifHeading>` — `Source Serif 4` 衬线大标题。

## 5. 收款聊天页 `ChainCashierChat` 重排(第 2 层)

商户页 + 付款页共用此组件。重排为 zip 范式,**保留全部功能逻辑,只换 JSX 表现层**。

```
┌─ 🫧 BackgroundBlobs ────────────────────────────────────┐
│ ┌ glass-island 顶部玻璃导航 ──────────────────────┐      │
│ │  ChainCashier · MERCHANT            [钱包按钮]  │      │
│ └─────────────────────────────────────────────────┘      │
│ ┌ 对话流(玻璃气泡)──────┐  ┌ FlowRecorder(玻璃)─┐    │
│ │ (用户)渐变胶囊          │  │ ✓ Merchant Goal…    │    │
│ │ (助手)毛玻璃卡片        │  │ ✓ Invoice Created   │    │
│ │   ├ Invoice 玻璃卡      │  │ ⋯ LI.FI Quote…     │    │
│ │   └ Quote 玻璃卡        │  │ [Run Log 导出]      │    │
│ │      [Approve & Pay 胶囊]│  └─────────────────────┘    │
│ └────────────────────────┘                              │
│      ┌─ PillComposer 浮动胶囊(底部固定)─────┐         │
│      │  🎤   Type your request...        ➤ │          │
│      └──────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

- **顶部导航**:`<GlassIsland>` —— 品牌 + 角色标签(Merchant / Payer)+ `WalletButton`。
- **气泡**:用户 = 渐变胶囊;助手 = 毛玻璃卡片;Thinking 推理折叠成玻璃胶囊。
- **卡片**:Invoice / Quote / Receipt → 玻璃卡片;`Approve & Pay` 用 `<GradientButton>`。
- **FlowRecorder**:ChainCashier 特有(zip 无对应),**保留并玻璃化**为右侧粘性玻璃面板——它是核心 demo 价值。步骤卡玻璃化,状态图标(`CheckCircle2` / `AlertTriangle` / `CircleDashed`)保留。
- **空状态**:`<SerifHeading>` 衬线大标题 + `<GradientButton>`「填入示例」(像 zip Landing 首屏)。
- **输入框**:底部浮动 `<PillComposer>`,对接现有 `onChangeAction / onSubmitAction / loading / onCancelAction`。
- **逻辑不动**:`sendMessage` / `executePayment` / 流式打字队列(`splitTypewriterText`)/ `sourceTxHash` 轮询 / localStorage 全部原样。
- **动效**:`motion/react` 消息淡入上移、卡片缩放、导航后呼吸光。

## 6. agent 聊天页 `Sidebar` + `ChatContent` 套用(第 3 层)

`app/agent` 页,复用第 1 层基元,把 Sidebar + ChatContent 双栏玻璃化。

```
┌─ 🫧 BackgroundBlobs ──────────────────────────────────────┐
│ ┌ Sidebar(玻璃化)──┐ ┌ 聊天区(玻璃)────────────────┐   │
│ │ + 新增对话(胶囊)  │ │ (空)SerifHeading 衬线大标题    │   │
│ │ 🔍 搜索(胶囊)     │ │      + 玻璃提示卡(zip 中央风)  │   │
│ │ ── 会话列表 ──    │ │                                │   │
│ │  ◌ conv-1 玻璃    │ │ (有消息)AI 毛玻璃卡 + Think 折叠 │   │
│ │  ◌ conv-2 玻璃    │ │         用户 渐变胶囊           │   │
│ └───────────────────┘ │ ┌ PillComposer 浮动胶囊(复用)┐ │   │
│                       │ │  🎤  Type your request... ➤ │ │   │
│                       │ └─────────────────────────────┘ │   │
│                       └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

- **整页**:加 `<BackgroundBlobs>`(当前是纯色 `--app-bg`)。
- **Sidebar**:`glass-island` 化;「新增对话」「搜索」胶囊化;会话项卡片玻璃化。**保留全部 Conversations 逻辑**(新建 / 搜索 / 分享 / 删除的事件通信)。
- **空状态 `Prompt`**:`<SerifHeading>` + 玻璃提示卡(像 zip ChatPage 中央大标题 + 可点提示)。
- **Bubble**:用户 = 渐变胶囊;AI = 毛玻璃卡片(通过 globals.css 令牌 + antd `variant`);**Think** 推理 → 玻璃折叠胶囊;**Actions**(复制 / 重试 / 分享)→ 玻璃图标。
- **输入框**:底部浮动 `<PillComposer>`(**复用第 5 节基元**,与收款页一致);classic_route 模式条 → 玻璃胶囊。
- **antd X 覆盖**:`globals.css` 中 `.ant-bubble / .ant-sender / .ant-conversations / .ant-think / .ant-actions` 的令牌值整体换 zip(蓝主色、Plus Jakarta、圆角胶囊、毛玻璃);暗色覆盖保留、配色改蓝。
- **逻辑不动**:全部事件通信(`SIDEBAR_*`、流式 `thinking/response/plan/step/...`)、钱包连接、`executePreviewTransaction` 原样。
- **取舍**:Sidebar 保留双栏结构(会话列表是功能,不重排成 zip 单栏 chat),只靠玻璃化 + 渐变 + 衬线标题 + 胶囊输入统一风格。

## 7. 技术注意点

- **利好·技术栈重合**:项目已装 `motion`(zip 用 `motion/react`)、`lucide-react`、Tailwind v4(`@theme` 语法一致);`globals.css` 现有 `@import` 已引入 Plus Jakarta Sans。**不引入新依赖**,只需补 Source Serif 4。
- **令牌**:`@theme` 定义新令牌,组件用 `font-serif` / `shadow-glass` 等类。
- **暗色模式**:保留 `next-themes` + `.dark`;新令牌给暗色对应值,antd 暗色覆盖改蓝。
- **RainbowKit**:已支持 `lightTheme()/darkTheme()`,改令牌后自动跟随。
- **antd X 深覆盖**:globals.css 上千行 `.ant-*` **只换令牌值,不删选择器**,保证 Bubble/Sender/Conversations/Think 不崩。
- **功能保护**:重构仅动 JSX 表现层 + CSS;不碰 `lib/` 逻辑、API 路由、状态机。

## 8. 验证

- `npx tsc --noEmit` + `npm run lint` + `npm run build` 全过。
- `tests/*.mjs`(纯 `lib/` 单测,不涉及 UI)继续绿,不受影响。
- dev server 手动走查三条路径:① 商户创建发票 → ② 付款页选链报价 → ③ agent 页对话;确认钱包连接、流式打字、报价卡、FlowRecorder、收据均正常 + 新风格生效。
- 回归点:两个聊天页视觉一致(同基元);antd X 不报样式错;暗色可读。

## 9. 实现顺序

1. 第 1 层地基:令牌(`globals.css`)+ 共享基元(`components/ui/`)。
2. 第 2 层:收款聊天页 `ChainCashierChat` 重排。
3. 第 3 层:agent 页 `Sidebar` + `ChatContent` 套用。

每阶段独立可验证。死代码(`HomeShell` / `views/*` / `ChainCashierDemo`)不动。
