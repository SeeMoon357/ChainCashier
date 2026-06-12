<p align="right">
  <a href="./DEPLOYMENT.md">English</a> | 简体中文
</p>

# 部署指南

这个项目是一个 Next.js 应用，包含服务端 Agent 路由、LI.FI API 集成，以及基于 RainbowKit / WalletConnect 的钱包连接。

它的部署模型本身比较直接：配置环境变量，启动 Next.js 应用，然后通过连接钱包完成端到端验证。

## 前置要求

- Node.js `22`
- npm
- 一个用于测试前端执行流程的钱包
- 至少一套可用的 AI provider key

## 1. 安装依赖

```bash
npm install
```

## 2. 配置环境变量

先复制样例文件，再填入你要使用的真实值：

```bash
cp .env.local.example .env.local
```

Windows PowerShell 下：

```powershell
Copy-Item .env.local.example .env.local
```

### 常用环境变量分组

#### AI provider keys

Agent runtime 至少需要配置一套可用 provider。

- `QWEN_API_KEY`
- `QWEN_BASE_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `ZHIPU_API_KEY`

不需要把所有 provider 都填满，只需要保证你实际使用的模型对应 key 可用。

#### LI.FI 配置

- `LIFI_API_KEY`
  可选。用于提升服务端 LI.FI 请求能力，生产或 demo 场景建议配置。
- `NEXT_PUBLIC_LIFI_EARN_DATA_URL`
  默认值是 `https://earn.li.fi`

#### 钱包配置

- `NEXT_PUBLIC_WC_PROJECT_ID`
  必填。用于 WalletConnect / RainbowKit 钱包连接。

#### 可选模型覆盖

如果你希望对不同 agent 单独指定模型，可以使用：

- `MAIN_AGENT_MODEL`
- `EARNING_AGENT_MODEL`
- `BRIDGE_AGENT_MODEL`
- `RISK_AGENT_MODEL`
- `MONITOR_AGENT_MODEL`

## 3. 本地运行

```bash
npm run dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。

## 4. 本地验证

最小验证清单：

1. 打开首页，确认 chat UI 正常加载
2. 能成功连接钱包
3. 发一条简单 prompt，例如 `Find the best available USDC vault on Base`
4. 确认页面能流式返回 agent 响应
5. 确认 `GET /api/agents` 返回健康状态 JSON

快速健康检查示例：

```bash
curl http://localhost:3000/api/agents
```

期望返回结构：

```json
{
  "status": "ok",
  "message": "Agent API is running",
  "supportedIntents": ["earn"],
  "version": "2.0.0"
}
```

## 5. 线上部署

### 推荐：Vercel

这个项目是标准 Next.js 应用，最自然的部署平台就是 Vercel。

推荐生产配置：

- Build command: `npm run build`
- Start command: `npm run start`
- Framework preset: `Next.js`

部署平台中需要同步配置和本地一致的环境变量：

- 你实际使用的 AI provider keys
- `NEXT_PUBLIC_WC_PROJECT_ID`
- 可选的 `LIFI_API_KEY`
- 你依赖的 per-agent model override

### 通用 Node 部署

如果不是部署到 Vercel，也可以使用任何支持 Next.js 生产构建的 Node 环境：

```bash
npm run build
npm run start
```

确保运行环境能读取到和本地一致的环境变量。

## 常见问题

### 钱包无法连接

最常见原因是 `NEXT_PUBLIC_WC_PROJECT_ID` 缺失或无效。

### Agent 请求一发就失败

通常意味着你当前选择的 AI provider key 缺失、无效，或和模型配置不匹配。

### LI.FI quote 不可用

常见原因包括：

- LI.FI 接口访问能力缺失或被限流
- 当前链 / 资产 / vault 组合不受支持
- 当前请求金额没有可用 route

这里更适合把它视为 route 或集成可用性问题，并先检查具体 quote 路径，再决定是否调整产品逻辑。

### Cross-chain route 完成了，但钱包里看不到 token

用户收到的可能不是普通 USDC，而是目标链上的 vault share token。这时建议：

- 先确认 LI.FI 最终 route 结果
- 检查 receiving transaction
- 把钱包切到目标链
- 如果钱包没有自动显示，手动导入 token 合约

### Polygon 流程后续缺 gas

当前版本不包含目标链 gas refueling，所以在 Polygon 上做后续手动操作时，用户可能仍然需要 `POL`。

## 推荐 Demo 配置

为了让 demo 更稳定：

- 先配置一套稳定的 AI provider
- 配置 `NEXT_PUBLIC_WC_PROJECT_ID`
- 有条件的话再加上 `LIFI_API_KEY`
- 先从 same-chain USDC 流程开始
- 再测试 Base 到 Arbitrum、Base 到 Polygon 这类受约束 cross-chain 路径
