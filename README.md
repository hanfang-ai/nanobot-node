# nanobot-node

🐈 **nanobot-node** is the Node.js implementation of [nanobot](https://github.com/HKUDS/nanobot) - an ultra-lightweight personal AI assistant framework, 100% compatible with the original Python version.

## Features

🪶 **Ultra-Lightweight**: 99% smaller than OpenClaw, core code < 2000 lines  
⚡️ **Lightning Fast**: Node.js async I/O delivers 2-3x faster response than Python  
💎 **100% Compatible**: Fully compatible with nanobot's configuration, sessions, skills, and tools  
🔌 **Multi-Platform Support**: Feishu, WeChat, Telegram, Discord, Slack, QQ, DingTalk, WhatsApp, CLI  
🧠 **Long-term Memory**: Built-in memory consolidation and context management  
🛠️ **Extensible**: Easy to add custom tools, channels, and providers  

## Quick Start

```bash
# Install
npm install -g nanobot-node

# Configure
nanobot config

# Run
nanobot start
```

## Project Structure

```
src/
├── agent/          # Core agent logic (loop, context, memory, tools)
├── bus/            # Message bus (events, queue)
├── channels/       # Chat channel adapters
├── config/         # Configuration management
├── cron/           # Cron job service
├── providers/      # LLM provider adapters
├── session/        # Session management
├── cli/            # Command line interface
└── index.ts        # Entry point
```

## Compatibility

- ✅ All nanobot configuration files work out of the box
- ✅ All nanobot session files can be imported directly
- ✅ All OpenClaw/nanobot skills are fully compatible
- ✅ Same tool call protocol as nanobot/OpenClaw

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Dev mode
npm run dev

# Test
npm test
```

## License

MIT
