const TelegramBot = require('node-telegram-bot-api');
const ollama = require('./ollama');
const system = require('./system');

class TelegramBotService {
  constructor(token) {
    this.bot = new TelegramBot(token, { 
      polling: true,
      autoReboot: true,
      restartMutex: true
    });
    this.setupCommands();
    this.setupDynamicHandler();
  }

  setupDynamicHandler() {
    this.bot.onText(/^(?!\/).*$/, async (msg) => {
      if (msg.text && msg.text.startsWith('/')) return;
      if (msg.chat.type === 'group' && !msg.text.startsWith('@')) return;

      const chatId = msg.chat.id;
      const text = msg.text || '';

      await this.handleDynamic(chatId, text);
    });
  }

  async handleDynamic(chatId, message) {
    const thinkingMsg = await this.bot.sendMessage(chatId, 'Thinking...');
    const text = String(message || '');
    console.log(`[INCOMING] Chat ${chatId}: ${text}`);

    try {
      const result = await ollama.dynamicAction(text);
      console.log(`[OLLAMA] Action: ${result.action}`, result.params);

      await this.bot.editMessageText('Executing...', {
        chat_id: chatId,
        message_id: thinkingMsg.message_id,
      });

      let response = await this.executeAction(result, chatId);
      console.log(`[REPLY] Chat ${chatId}: ${response}`);

      await this.bot.editMessageText(response, {
        chat_id: chatId,
        message_id: thinkingMsg.message_id,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.error(`[ERROR] Chat ${chatId}: ${err.message}`);
      await this.bot.editMessageText(`Error: ${err.message}`, {
        chat_id: chatId,
        message_id: thinkingMsg.message_id,
      });
    }
  }

  async executeAction(actionData, chatId) {
    const { action, params, response } = actionData;

    switch (action) {
      case 'open_app': {
        const { name, command, then_type } = params;
        let appName = name || command;
        if (!appName) throw new Error('No app specified');
        
        appName = appName.toLowerCase().replace('.exe', '');
        
        if (appName === 'chrome' || appName === 'browser') {
          const defaultProfile = 'Profile 1';
          let searchTerm = then_type;
          if (!searchTerm && command) {
            const match = command.match(/search\s+(.+)/i);
            if (match) searchTerm = match[1];
          }
          if (searchTerm) {
            searchTerm = searchTerm.replace(/^(search\s+for|browse\s+for|look\s+up|find)\s+/i, '').trim();
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
            await system.runCommand(`start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --profile-directory="${defaultProfile}" "${searchUrl}"`);
            return `Opened Chrome (${defaultProfile}) and searched for "${searchTerm}"`;
          }
          await system.runCommand(`start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --profile-directory="${defaultProfile}"`);
          return `Opened Chrome (${defaultProfile})`;
        }
        
        const builtInApps = {
          'notepad': 'notepad.exe',
          'calculator': 'calc.exe',
          'calc': 'calc.exe',
          'explorer': 'explorer.exe',
          'cmd': 'cmd.exe',
          'powershell': 'powershell.exe',
          'taskmgr': 'taskmgr.exe',
          'control': 'control.exe',
          'paint': 'mspaint.exe',
          'wordpad': 'write.exe',
        };
        
        if (builtInApps[appName]) {
          const cmd = builtInApps[appName];
          if (cmd.startsWith('start ')) {
            await system.runCommand(cmd);
          } else {
            await system.runCommand(`start "" "${cmd}"`);
          }
        } else {
          await system.openApp(appName);
        }
        
        await new Promise(r => setTimeout(r, 800));
        
        if (then_type) {
          await system.typeText(then_type);
          return `Opened ${name || command} and typed "${then_type}"`;
        }
        return `Opened ${name || command}`;
      }

      case 'close_app': {
        const { name } = params;
        if (!name) throw new Error('No app specified');
        await system.closeApp(name);
        return `Closed ${name}`;
      }

      case 'run_command': {
        const { command } = params;
        if (!command) throw new Error('No command specified');
        const result = await system.runCommand(command);
        const output = result.substring(0, 2000) || 'Command executed';
        return `Output:\n\`\`\`\n${output}\n\`\`\``;
      }

      case 'type_text': {
        const { text } = params;
        if (!text) throw new Error('No text specified');
        await system.typeText(text);
        return `Typed: ${text}`;
      }

      case 'send_keys': {
        const { keys } = params;
        if (!keys) throw new Error('No keys specified');
        await system.sendKeys(keys);
        return `Sent keys: ${keys}`;
      }

      case 'calculate': {
        const { expression } = params;
        if (!expression) throw new Error('No expression specified');
        try {
          const result = eval(expression);
          return `${expression} = ${result}`;
        } catch (e) {
          const calcResult = await system.runCommand(`powershell -Command "${expression}"`);
          return `${expression} = ${calcResult.trim()}`;
        }
      }

      case 'take_screenshot': {
        const path = await system.takeScreenshot();
        await this.bot.sendPhoto(chatId, path);
        return `Screenshot captured`;
      }

      case 'list_files': {
        const { path: dirPath } = params;
        const files = await system.listDirectory(dirPath || '.');
        const list = files.slice(0, 30).map(f => 
          `${f.isDirectory ? 'DIR' : 'FILE'} ${f.name}`
        ).join('\n');
        return `Files:\n${list}`;
      }

      case 'get_sysinfo': {
        const info = await system.getSystemInfo();
        return `System Info:\n\n` +
          `Platform: ${info.platform}\n` +
          `CPU Cores: ${info.cpus}\n` +
          `RAM: ${info.freeMemory} / ${info.totalMemory}\n` +
          `Hostname: ${info.hostname}`;
      }

      case 'open_folder': {
        const { path: folderPath } = params;
        if (!folderPath) throw new Error('No folder path specified');
        await system.openFolder(folderPath);
        return `Opened folder: ${folderPath}`;
      }

      case 'open_url': {
        const { url } = params;
        if (!url) throw new Error('No URL specified');
        await system.openUrl(url);
        return `Opened: ${url}`;
      }

      case 'query':
      default:
        return response || 'Done';
    }
  }

  setupCommands() {
    this.bot.onText(/\/start/, (msg) => {
      this.bot.sendMessage(msg.chat.id, 
`Ollama AI Bot

Just type anything and I'll understand what you need! I can:

- Open apps (calculator, notepad, browser...)
- Run commands
- Take screenshots
- Get system info
- Type text or send keys
- Answer questions

Just be natural - "open calculator and type 5+8" or "what time is it"

/models - List AI models
/chrome - Open Chrome (choose profile)
/help - Show this message`, { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/help/, (msg) => {
      this.bot.sendMessage(msg.chat.id, 'Just send me a message and I will understand what to do!', { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/models/, async (msg) => {
      const chatId = msg.chat.id;
      const thinkingMsg = await this.bot.sendMessage(chatId, 'Loading models...');
      try {
        const models = await ollama.listModels();
        if (models.length === 0) {
          await this.bot.editMessageText('No models installed.', {
            chat_id: chatId,
            message_id: thinkingMsg.message_id,
          });
          return;
        }
        const modelList = models.map(m => `- ${m.name}`).join('\n');
        await this.bot.editMessageText(`Installed Models:\n\n${modelList}`, {
          chat_id: chatId,
          message_id: thinkingMsg.message_id,
          parse_mode: 'Markdown',
        });
      } catch (err) {
        await this.bot.editMessageText(`Error: ${err.message}`, {
          chat_id: chatId,
          message_id: thinkingMsg.message_id,
        });
      }
    });

    this.bot.onText(/\/chrome/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, 'Choose Chrome profile:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Profile 1', callback_data: 'chrome_profile_1' }],
            [{ text: 'Profile 2', callback_data: 'chrome_profile_2' }],
            [{ text: 'Profile 3', callback_data: 'chrome_profile_3' }],
          ],
        },
      });
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      if (data.startsWith('chrome_profile_')) {
        const profile = data.replace('chrome_profile_', '');
        await system.runCommand(`start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --profile-directory="Profile ${profile}"`);
        await this.bot.answerCallbackQuery(query.id, { text: `Opening Chrome Profile ${profile}...` });
        await this.bot.editMessageText(`Opened Chrome Profile ${profile}`, {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
      }
    });

    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error.message);
    });

    this.bot.on('error', (error) => {
      console.error('Bot error:', error.message);
    });
  }

  start() {
    console.log('Telegram bot is running...');
  }

  stop() {
    this.bot.stopPolling();
  }
}

module.exports = TelegramBotService;
