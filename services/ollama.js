const ollama = require('ollama').default;

const DEFAULT_MODEL = 'llama3.2:1b';

async function chat(message, model = DEFAULT_MODEL, history = []) {
  // Ensure message is always a plain string - Ollama Go server rejects arrays
  const contentStr = Array.isArray(message) ? message.join(' ') : String(message || '');
  const messages = [
    ...history.map(h => ({ ...h, content: String(h.content || '') })),
    { role: 'user', content: contentStr }
  ];
  const response = await ollama.chat({
    model,
    messages,
    stream: false,
  });
  return response.message.content;
}

async function* streamChat(message, model = DEFAULT_MODEL) {
  const contentStr = Array.isArray(message) ? message.join(' ') : String(message || '');
  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: contentStr }],
    stream: true,
  });
  for await (const part of response) {
    yield part.message.content;
  }
}

async function debug(code, language = 'javascript', model = DEFAULT_MODEL) {
  const prompt = `You are a code debugger. Analyze the following ${language} code, identify bugs, and explain how to fix them.

Code:
\`\`\`${language}
${code}
\`\`\`

Provide:
1. List of bugs found (if any)
2. Explanation of each bug
3. Fixed code
4. Best practices notes`;

  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: String(prompt) }],
    stream: false,
  });
  return response.message.content;
}

async function explainCode(code, language = 'javascript', model = DEFAULT_MODEL) {
  const prompt = `Explain this ${language} code in simple terms:

\`\`\`${language}
${code}
\`\`\``;

  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: String(prompt) }],
    stream: false,
  });
  return response.message.content;
}

async function generateCode(spec, language = 'javascript', model = DEFAULT_MODEL) {
  const prompt = `Generate ${language} code based on this specification. Only output the code with minimal comments:

Specification: ${spec}`;

  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: String(prompt) }],
    stream: false,
  });
  return response.message.content;
}

async function listModels() {
  const result = await ollama.list();
  return result.models || [];
}

async function dynamicAction(userMessage, model = DEFAULT_MODEL) {
  const systemPrompt = `You are an intelligent PC control assistant. Analyze the user's natural language message and decide what action to take.

IMPORTANT: You must respond with ONLY valid JSON. No explanations, no markdown, no code blocks. Just the raw JSON object.

Available actions:
- open_app: Open an application (name, command, then_type for text to type/search after opening)
- close_app: Close an application by name (name)
- run_command: Run a terminal/system command (command)
- type_text: Type text in the active window (text)
- send_keys: Send keyboard keys/shortcuts like F11 (fullscreen), Enter, Escape, Ctrl+C (keys)
- calculate: Perform a math calculation (expression)
- take_screenshot: Take a screenshot of the screen
- list_files: List files in a directory (path), default is current directory "."
- get_sysinfo: Get system information
- open_folder: Open a folder in file explorer (path)
- open_url: Open a URL in browser (url)
- query: Answer a general question directly

JSON format: {"action": "action_type", "params": {"key": "value"}, "response": "brief message"}

Common commands:
- notepad.exe = notepad
- calc.exe = calculator
- chrome.exe or start chrome = browser
- explorer.exe = file explorer

For questions use query action

Examples:
User: "open notepad"
{"action": "open_app", "params": {"name": "notepad", "command": "notepad.exe"}, "response": "Opened Notepad"}

User: "open calculator and type 5+8"
{"action": "open_app", "params": {"name": "calculator", "command": "calc.exe", "then_type": "5+8"}, "response": "Opened Calculator and typed 5+8"}

User: "calculate 7 minus 2999"
{"action": "calculate", "params": {"expression": "7-2999"}, "response": "7 minus 2999 equals -2992"}

User: "what time is it"
{"action": "query", "params": {"question": "what time is it"}, "response": "It's [current time]"}

User: "take a screenshot"
{"action": "take_screenshot", "params": {}, "response": "Screenshot captured"}

User: "show me files in the current folder"
{"action": "list_files", "params": {"path": "."}, "response": "Here are the files"}

User: "run ipconfig"
{"action": "run_command", "params": {"command": "ipconfig"}, "response": "Command output above"}

User: "open settings"
{"action": "open_url", "params": {"url": "ms-settings:"}, "response": "Opened Settings"}

User: "close notepad"
{"action": "close_app", "params": {"name": "notepad"}, "response": "Closed Notepad"}

User: "quit chrome"
{"action": "close_app", "params": {"name": "chrome"}, "response": "Closed Chrome"}

User: "open chrome and search for python"
{"action": "open_app", "params": {"name": "chrome", "command": "chrome.exe", "then_type": "python"}, "response": "Opened Chrome and searched for python"}

User: "open chrome and search for today's news"
{"action": "open_app", "params": {"name": "chrome", "command": "chrome.exe", "then_type": "today's news"}, "response": "Opened Chrome and searched for today's news"}

User: "open chrome and search for python"
{"action": "open_app", "params": {"name": "chrome", "command": "chrome.exe", "then_type": "python"}, "response": "Opened Chrome and searched for python"}

User: "search for weather in google chrome"
{"action": "open_app", "params": {"name": "chrome", "command": "chrome.exe", "then_type": "weather"}, "response": "Opened Chrome and searched for weather"}

User: "browse for python tutorial"
{"action": "open_app", "params": {"name": "chrome", "command": "chrome.exe", "then_type": "python tutorial"}, "response": "Opened Chrome and searched for python tutorial"}

User: "open browser and find latest movies"
{"action": "open_app", "params": {"name": "chrome", "command": "chrome.exe", "then_type": "latest movies"}, "response": "Opened Chrome and searched for latest movies"}

User: "open notepad and type hello world"
{"action": "open_app", "params": {"name": "notepad", "command": "notepad.exe", "then_type": "hello world"}, "response": "Opened Notepad and typed hello world"}

User: "expand chrome tab to fullscreen"
{"action": "send_keys", "params": {"keys": "F11"}, "response": "Expanded to fullscreen"}

User: "make chrome fullscreen"
{"action": "send_keys", "params": {"keys": "F11"}, "response": "Expanded to fullscreen"}

User: "take a screenshot"
{"action": "take_screenshot", "params": {}, "response": "Screenshot captured"}

User: "screenshot"
{"action": "take_screenshot", "params": {}, "response": "Screenshot captured"}

User: "expand the chrome tab to full screen"
{"action": "send_keys", "params": {"keys": "F11"}, "response": "Expanded to fullscreen"}

User: "expand chrome to fullscreen"
{"action": "send_keys", "params": {"keys": "F11"}, "response": "Expanded to fullscreen"}

User: "make browser full screen"
{"action": "send_keys", "params": {"keys": "F11"}, "response": "Expanded to fullscreen"}

User: "maximize window"
{"action": "send_keys", "params": {"keys": "F11"}, "response": "Window maximized"}
`;

const response = await ollama.chat({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: String(userMessage || '') }
    ],
    stream: false,
  });

  const content = response.message.content;
  console.log('[OLLAMA RAW]:', content);

  try {
    let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let startIdx = cleanContent.indexOf('{');
    
    if (startIdx === -1) {
      throw new Error('No JSON object found');
    }
    
    let jsonStr = cleanContent.substring(startIdx);
    
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let endIdx = jsonStr.length;
    
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\' && inString) {
        escape = true;
        continue;
      }
      if (char === '"' && !escape) {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
    }
    
    jsonStr = jsonStr.substring(0, endIdx);
    
    try {
      let parsed = JSON.parse(jsonStr);
      parsed.response = String(parsed.response || '').replace(/[*_`#]/g, '');
      return parsed;
    } catch (parseErr) {
      console.log('[JSON PARSE ERROR] Trying to fix...');
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/}\s*}/g, '}');
      try {
        let parsed = JSON.parse(jsonStr);
        parsed.response = String(parsed.response || '').replace(/[*_`#]/g, '');
        return parsed;
      } catch (e2) {
        console.error('Failed to parse Ollama response:', parseErr);
      }
    }
  } catch (e) {
    console.error('Failed to parse Ollama response:', e);
  }
  
  return { action: 'query', params: { question: userMessage }, response: content.replace(/[*_`#]/g, '') };
}

module.exports = {
  chat,
  streamChat,
  debug,
  explainCode,
  generateCode,
  listModels,
  dynamicAction,
  DEFAULT_MODEL,
};
