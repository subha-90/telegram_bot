#!/usr/bin/env node
require('dotenv').config();
const chalk = require('chalk');
const readlineSync = require('readline-sync');
const fs = require('fs');
const path = require('path');
const ollama = require('./services/ollama');
const TelegramBotService = require('./services/telegram');

const commands = {
  chat: 'Start a chat session with Ollama',
  debug: 'Debug a code file',
  explain: 'Explain code from a file',
  build: 'Generate code from a specification',
  models: 'List available Ollama models',
  bot: 'Start the Telegram bot',
  help: 'Show this help message',
};

function spin(text) {
  process.stdout.write(chalk.cyan(`\r${text}`));
}

function clearSpin() {
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

async function showHelp() {
  console.log(chalk.cyan('\nOllama CLI Assistant\n'));
  console.log(chalk.yellow('Usage: node cli.js <command> [options]\n'));
  console.log('Commands:');
  for (const [cmd, desc] of Object.entries(commands)) {
    console.log(`  ${chalk.green(cmd.padEnd(10))} ${desc}`);
  }
  console.log(chalk.cyan('\nExamples:'));
  console.log('  node cli.js chat');
  console.log('  node cli.js debug ./src/app.js');
  console.log('  node cli.js explain ./utils/helper.js');
  console.log('  node cli.js build "a simple todo app with Node.js"\n');
}

async function handleChat() {
  console.log(chalk.green('Chat mode started. Type "exit" to quit.\n'));
  
  const history = [];
  
  while (true) {
    const input = readlineSync.question(chalk.blue('You: '));
    if (input.toLowerCase() === 'exit') break;
    
    history.push({ role: 'user', content: input });
    
    spin('Thinking...');
    
    try {
      const response = await ollama.chat(history.map(h => ({ role: h.role, content: h.content })).join('\n'));
      clearSpin();
      console.log(chalk.yellow(`\nAssistant: ${response}\n`));
      history.push({ role: 'assistant', content: response });
    } catch (err) {
      clearSpin();
      console.log(chalk.red(`Error: ${err.message}\n`));
    }
  }
}

async function handleDebug(filePath) {
  if (!filePath) {
    console.log(chalk.red('Error: Please provide a file path'));
    console.log('Usage: node cli.js debug <file-path>');
    return;
  }

  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(chalk.red(`Error: File not found: ${fullPath}`));
    return;
  }

  const code = fs.readFileSync(fullPath, 'utf-8');
  const ext = path.extname(fullPath).slice(1) || 'javascript';
  const language = ext === 'js' ? 'javascript' : ext === 'ts' ? 'typescript' : ext;

  console.log(chalk.cyan(`\nDebugging ${path.basename(fullPath)}...\n`));
  spin('Analyzing code...');

  try {
    const result = await ollama.debug(code, language);
    clearSpin();
    console.log(chalk.yellow(result));
  } catch (err) {
    clearSpin();
    console.log(chalk.red(`Error: ${err.message}`));
  }
}

async function handleExplain(filePath) {
  if (!filePath) {
    console.log(chalk.red('Error: Please provide a file path'));
    console.log('Usage: node cli.js explain <file-path>');
    return;
  }

  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(chalk.red(`Error: File not found: ${fullPath}`));
    return;
  }

  const code = fs.readFileSync(fullPath, 'utf-8');
  const ext = path.extname(fullPath).slice(1) || 'javascript';
  const language = ext === 'js' ? 'javascript' : ext === 'ts' ? 'typescript' : ext;

  console.log(chalk.cyan(`\nExplaining ${path.basename(fullPath)}...\n`));
  spin('Analyzing code...');

  try {
    const result = await ollama.explainCode(code, language);
    clearSpin();
    console.log(chalk.green(result));
  } catch (err) {
    clearSpin();
    console.log(chalk.red(`Error: ${err.message}`));
  }
}

async function handleBuild(spec) {
  if (!spec) {
    console.log(chalk.red('Error: Please provide a specification'));
    console.log('Usage: node cli.js build "description of what to build"');
    return;
  }

  console.log(chalk.cyan(`\nBuilding project based on: "${spec}"\n`));
  spin('Generating code...');

  try {
    const code = await ollama.generateCode(spec);
    clearSpin();
    console.log(chalk.green(code));
    
    const save = readlineSync.question(chalk.blue('\nSave to file? (y/N): '));
    if (save.toLowerCase() === 'y') {
      const fileName = readlineSync.question('File name: ');
      fs.writeFileSync(fileName, code);
      console.log(chalk.green(`Saved to ${fileName}`));
    }
  } catch (err) {
    clearSpin();
    console.log(chalk.red(`Error: ${err.message}`));
  }
}

async function handleModels() {
  spin('Fetching models...');
  try {
    const models = await ollama.listModels();
    clearSpin();
    
    if (models.length === 0) {
      console.log(chalk.yellow('No models installed. Run: ollama pull <model-name>'));
      return;
    }

    console.log(chalk.cyan('\nInstalled Models:\n'));
    models.forEach(m => {
      console.log(`  ${chalk.green(m.name)} - ${m.size || 'unknown size'}`);
    });
    console.log();
  } catch (err) {
    clearSpin();
    console.log(chalk.red(`Error: ${err.message}`));
  }
}

function handleBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(chalk.red('Error: TELEGRAM_BOT_TOKEN is not set in .env file'));
    console.log(chalk.yellow('Create a .env file with: TELEGRAM_BOT_TOKEN=your_token_here'));
    console.log(chalk.cyan('\nTo get a token:'));
    console.log('1. Message @BotFather on Telegram');
    console.log('2. Use /newbot command');
    console.log('3. Follow the instructions');
    return;
  }

  const bot = new TelegramBotService(token);
  bot.start();

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nStopping bot...'));
    bot.stop();
    process.exit(0);
  });
}

const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  switch (command) {
    case 'chat':
      await handleChat();
      break;
    case 'debug':
      await handleDebug(arg);
      break;
    case 'explain':
      await handleExplain(arg);
      break;
    case 'build':
      await handleBuild(arg);
      break;
    case 'models':
      await handleModels();
      break;
    case 'bot':
      handleBot();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      if (!command) {
        await handleChat();
      } else {
        await showHelp();
      }
  }
})();
