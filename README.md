# Ollama Assistant

Personal AI assistant powered by Ollama with Telegram bot control for your PC.

## Features

- **Chat with AI**: Have conversations with Ollama models
- **PC Control via Telegram**: Control your computer using natural language
- **Open Apps**: calculator, notepad, chrome, etc.
- **Chrome Search**: "open chrome and search for python"
- **Close Apps**: "close notepad"
- **Fullscreen**: "expand chrome to fullscreen" (sends F11)
- **Screenshots**: Capture and send screenshots
- **Run Commands**: Execute system commands
- **Type Text**: Type text in active windows

## Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Create `.env` file**:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

Get token from @BotFather on Telegram.

3. **Start Ollama**:
```bash
ollama serve
```

4. **Start the bot**:
```bash
node cli.js bot
```

## Telegram Commands

- `/start` - Show welcome message
- `/help` - Show help
- `/models` - List installed Ollama models
- `/chrome` - Open Chrome with profile selection

## Natural Language Examples

```
Open calculator
Open chrome and search for today's news
Expand chrome to fullscreen
Close calculator
Take screenshot
Show files in Documents
Run ipconfig
Type hello world
```

## Requirements

- Node.js 18+
- Ollama running locally
- Telegram bot token
- Windows (most features optimized for Windows)

## Available Models

By default uses `llama3.2:1b`. Change in `services/ollama.js`.
