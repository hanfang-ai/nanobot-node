# nanobot-node 技术架构文档

## 📋 项目概述
nanobot-node 是 Python 版 nanobot 的 Node.js 完全复刻实现，目标是 100% 功能对齐、接口兼容、生态互通。

## 🏗️ 整体架构
采用极简分层架构，核心模块耦合度极低，便于扩展和二次开发：

```
┌─────────────────────────────────────────────────────────┐
│                     CLI / Web UI                         │
├─────────────────────────────────────────────────────────┤
│                   Channels 适配层                        │
│  飞书 | 微信 | Telegram | Discord | Slack | QQ | 钉钉    │
├─────────────────────────────────────────────────────────┤
│                   Agent 核心层                          │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  AgentLoop │  │  Context │  │  Memory System   │    │
│  └────────────┘  └──────────┘  └──────────────────┘    │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ ToolSystem │  │ Subagent │  │ Cron Scheduler   │    │
│  └────────────┘  └──────────┘  └──────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                      公共组件层                         │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ MessageBus │  │ Session  │  │     Config       │    │
│  └────────────┘  └──────────┘  └──────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                   Provider 适配层                       │
│  OpenAI | Anthropic | DeepSeek | Moonshot | 本地LLM    │
└─────────────────────────────────────────────────────────┘
```

## 🧩 核心模块详解

### 1. MessageBus 消息总线 (`src/bus/`)
**职责**：解耦各模块之间的通信，实现事件驱动架构
- 基于 Node.js 原生 EventEmitter 实现
- 支持异步事件发布/订阅
- 内置消息队列，支持消息积压和异步消费
- 事件类型：入站消息、出站消息、工具调用、工具结果、错误事件

**核心接口**：
```typescript
publish(event: BusEvent): void
subscribe<T>(eventType: EventType, handler: (payload: T) => void): void
publish_inbound(message: InboundMessage): void
publish_outbound(message: OutboundMessage): void
consume_inbound(timeout?: number): Promise<InboundMessage | null>
```

### 2. ToolSystem 工具系统 (`src/agent/tools/`)
**职责**：管理所有可用工具，处理工具调用请求
- 注册制设计，新增工具只需继承 `BaseTool` 类
- 自动参数校验，基于 JSON Schema
- 支持并行工具调用
- 内置工具：文件读写、Shell执行、网页抓取、网络搜索、消息发送、子Agent生成、定时任务

**工具开发规范**：
```typescript
class MyTool extends BaseTool {
  name = 'my_tool';
  description = '工具描述';
  parameters = {
    type: 'object',
    properties: { param1: { type: 'string', description: '参数1' } },
    required: ['param1']
  };
  
  async run(params: Record<string, any>): Promise<string> {
    // 工具逻辑
    return '结果';
  }
}
```

### 3. ContextBuilder 上下文构建器 (`src/agent/context.ts`)
**职责**：构建 LLM 所需的会话上下文
- 自动拼接系统提示词、历史消息、当前消息
- 支持多模态消息（图片/文件）
- 自动管理工具调用和结果的上下文格式
- 内置 `<think>` 块清洗逻辑

### 4. AgentLoop 核心循环 (`src/agent/loop.ts`)
**职责**：Agent 核心处理流程，是整个系统的大脑
- 工作流：`接收消息 → 构建上下文 → 调用LLM → 解析工具调用 → 执行工具 → 生成回复 → 保存会话`
- 最大迭代次数限制（默认40轮），避免死循环
- 支持任务取消机制（`/stop` 命令）
- 进度流式输出，实时反馈工具调用状态
- 内置错误处理和降级逻辑

### 5. Session 会话管理 (`src/session/`)
**职责**：持久化会话历史，管理多用户会话
- 会话存储在 JSON 文件中，格式和 Python 版 nanobot 完全兼容
- 自动合并历史消息，超过上下文窗口时自动压缩
- 支持会话导入/导出
- 多用户会话隔离

### 6. Channels 通道适配层 (`src/channels/`)
**职责**：适配不同的聊天平台，统一消息格式
- 每个通道独立实现，继承 `BaseChannel` 抽象类
- 统一消息格式，上层 Agent 不需要关心平台差异
- 支持媒体消息（图片/文件/语音）的统一处理
- 已支持通道：CLI、飞书、Telegram、Discord、Slack、QQ、钉钉、WhatsApp、Matrix

**通道开发规范**：
```typescript
class MyChannel extends BaseChannel {
  name = 'my_channel';
  
  async start(): Promise<void> {
    // 初始化通道连接
  }
  
  async send_message(chat_id: string, content: string, options?: any): Promise<void> {
    // 发送消息逻辑
  }
  
  // 接收消息时调用 messageBus.publish_inbound()
}
```

### 7. Provider 模型适配层 (`src/providers/`)
**职责**：适配不同的大模型提供商，统一接口
- 基于 LiteLLM 实现，支持所有主流大模型
- 统一工具调用格式，不管模型原生是否支持工具调用
- 自动重试、错误处理、限流控制
- 支持本地 LLM（Ollama、vLLM、SGLang）
- 支持运行时动态切换模型

## 🔌 兼容性设计

### 配置文件兼容
- 完全兼容 Python 版 nanobot 的配置文件格式
- 支持 YAML/JSON 两种配置格式
- 配置项 1:1 对齐，无需修改即可直接使用

### 会话文件兼容
- 会话存储格式和 Python 版完全一致
- 支持直接导入 Python 版 nanobot 的会话文件
- 记忆合并策略和 Python 版保持一致

### 技能生态兼容
- 完全兼容 OpenClaw/nanobot 的 Skill 生态
- 支持 Markdown 格式的 Skill 文件
- 工具调用协议和 OpenClaw 完全对齐

### 工具接口兼容
- 所有内置工具的参数和返回值和 Python 版完全一致
- 支持 MCP(模型上下文协议)，可对接外部工具服务

## ⚡ 性能优化

### 异步IO模型
- 全链路异步化，基于 Node.js 事件循环，IO 密集型场景性能比 Python 版高 2-3 倍
- 工具调用并行执行，提高响应速度
- 非阻塞消息处理，支持高并发场景

### 内存优化
- 会话历史懒加载，只有需要时才读取到内存
- 大工具结果自动截断，避免上下文溢出
- 定期清理过期会话，减少内存占用

### 启动速度
- 冷启动时间 < 500ms，比 Python 版快 10 倍以上
- 依赖极简，无冗余模块，打包后单文件可执行

## 🛡️ 安全设计

### 权限控制
- Shell 命令执行默认限制在工作目录内
- 文件操作默认限制在工作目录，禁止访问系统敏感路径
- 支持细粒度的工具权限配置

### 输入输出过滤
- 自动过滤敏感信息（API Key、密码等）
- 危险命令拦截（`rm -rf /`、格式化磁盘等）
- 工具调用审计日志，所有操作可追溯

### 会话隔离
- 多用户会话完全隔离，避免数据泄露
- 支持配置每个用户的可用工具和资源限制

## 📦 部署方式

### 1. NPM 全局安装
```bash
npm install -g nanobot-node
nanobot start
```

### 2. Docker 部署
```dockerfile
FROM node:20-alpine
RUN npm install -g nanobot-node
CMD ["nanobot", "start"]
```

### 3. 单文件可执行
使用 `pkg` 打包为单文件，无需 Node.js 环境：
```bash
npm run build
pkg . --output nanobot
./nanobot start
```

## 📈 技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.3+ | 类型安全的开发语言 |
| Node.js | 20+ | 运行时环境 |
| LiteLLM | 1.82+ | 大模型统一适配 |
| Zod | 3.22+ | 参数校验 |
| LowDB | 7.0+ | 轻量级JSON数据库 |
| Node Cron | 3.0+ | 定时任务 |
| Pino | 8.19+ | 高性能日志 |
| Commander | 12.0+ | CLI框架 |

## 🤝 贡献指南
1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 代码规范
- 使用 TypeScript，严格类型检查
- 遵循 ESLint 配置
- 提交信息遵循 Conventional Commits 规范
- 核心功能必须有单元测试

## 📄 许可证
MIT License - 详见 LICENSE 文件
