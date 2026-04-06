const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class SystemController {
  async execute(command) {
    return new Promise((resolve, reject) => {
      exec(command, { shell: true }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout || stderr);
      });
    });
  }

  async openFolder(folderPath) {
    const fullPath = path.resolve(folderPath);
    if (process.platform === 'win32') {
      return this.execute(`explorer "${fullPath}"`);
    } else if (process.platform === 'darwin') {
      return this.execute(`open "${fullPath}"`);
    }
    return this.execute(`xdg-open "${fullPath}"`);
  }

  async openFile(filePath) {
    const fullPath = path.resolve(filePath);
    if (process.platform === 'win32') {
      return this.execute(`start "" "${fullPath}"`);
    } else if (process.platform === 'darwin') {
      return this.execute(`open "${fullPath}"`);
    }
    return this.execute(`xdg-open "${fullPath}"`);
  }

  async openUrl(url) {
    if (process.platform === 'win32') {
      return this.execute(`start ${url}`);
    } else if (process.platform === 'darwin') {
      return this.execute(`open ${url}`);
    }
    return this.execute(`xdg-open ${url}`);
  }

  async openApp(appName) {
    if (process.platform === 'win32') {
      const search = appName.toLowerCase();
      
      const systemApps = {
        'system information': 'msinfo32.exe',
        'system info': 'msinfo32.exe',
        'msinfo': 'msinfo32.exe',
        'postman': 'postman.exe',
        'calculator': 'calc.exe',
        'chrome': 'chrome',
        'google chrome': 'chrome',
        'notepad': 'notepad.exe',
        'word': 'winword.exe',
        'excel': 'excel.exe',
        'excel': 'excel.exe',
        'powershell': 'powershell.exe',
        'cmd': 'cmd.exe',
        'terminal': 'wt.exe',
      };

      if (systemApps[search]) {
        if (search === 'chrome' || search === 'google chrome') {
          return this.execute(`start "" chrome`);
        }
        return this.execute(`start "" ${systemApps[search]}`);
      }

      try {
        const result = await this.execute(`powershell -Command "$shell = New-Object -ComObject Shell.Application; $startMenu = $shell.NameSpace(0x0b); $items = $startMenu.Items(); $found = $items | Where-Object { $_.Name -like '*${search}*' -and $_.IsFolder -eq $false } | Select-Object -First 1; if ($found) { $found.GetLink().Path } else { 'NOT_FOUND' }"`);
        if (result && result.trim() && result.trim() !== 'NOT_FOUND') {
          console.log(`[OPENAPP] Found in Start: ${result.trim()}`);
          return this.execute(`start "" "${result.trim()}"`);
        }
      } catch (e) {
        console.log(`[OPENAPP] Start search failed: ${e.message}`);
      }

      try {
        const result = await this.execute(`powershell -Command "Get-ChildItem '$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs', '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs' -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -like '*${search}*' } | Select-Object -First 1 -ExpandProperty FullName"`);
        if (result && result.trim()) {
          console.log(`[OPENAPP] Found .lnk: ${result.trim()}`);
          return this.execute(`start "" "${result.trim()}"`);
        }
      } catch (e) {
        console.log(`[OPENAPP] Lnk search failed: ${e.message}`);
      }

      try {
        const result = await this.execute(`powershell -Command "Get-ChildItem '$env:ProgramFiles', '$env:ProgramFiles(x86)', '$env:LocalAppData' -Recurse -Filter '*.exe' -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -like '*${search}*' } | Select-Object -First 1 -ExpandProperty FullName"`);
        if (result && result.trim()) {
          console.log(`[OPENAPP] Found .exe: ${result.trim()}`);
          return this.execute(`start "" "${result.trim()}"`);
        }
      } catch (e) {
        console.log(`[OPENAPP] Exe search failed: ${e.message}`);
      }

      try {
        await this.execute(`powershell -Command "Start-Process '${appName}' -ErrorAction SilentlyContinue"`);
        return;
      } catch (e) {}

      throw new Error(`Could not find ${appName}. Is it installed?`);
    }
    return this.execute(`open -a "${appName}"`);
  }

  async closeApp(appName) {
    if (process.platform === 'win32') {
      const search = appName.toLowerCase().replace('.exe', '');
      return this.execute(`powershell -Command "Get-Process -Name '*${search}*' -ErrorAction SilentlyContinue | Stop-Process -Force"`);
    }
    return this.execute(`osascript -e 'tell application "${appName}" to quit'`);
  }

  async sendKeys(keys) {
    if (process.platform === 'win32') {
      const keyMap = {
        'F11': '{F11}',
        'F5': '{F5}',
        'enter': '{ENTER}',
        'escape': '{ESC}',
        'esc': '{ESC}',
      };
      const mapped = keyMap[keys.toLowerCase()] || keys;
      const escapedKeys = mapped.replace(/"/g, '\\"');
      return this.execute(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedKeys}')"`);
    }
    return this.execute(`osascript -e 'tell application "System Events" to keystroke "${keys}"'`);
  }

  async typeText(text, delay = 50) {
    if (process.platform === 'win32') {
      const specialChars = {
        '+': '{+}',
        '%': '{%}',
        '^': '{^}',
        '~': '{~}',
        '(': '{(}',
        ')': '{)}',
        '{': '{{}',
        '}': '{}}',
      };
      let escaped = '';
      for (const char of text) {
        escaped += specialChars[char] || char;
      }
      return this.execute(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}'); Start-Sleep -Milliseconds ${delay}"`);
    }
    return this.execute(`osascript -e 'tell application "System Events" to keystroke "${text}"'`);
  }

  async runCommand(command) {
    return this.execute(command);
  }

  async listDirectory(dirPath = '.') {
    let fullPath = path.resolve(dirPath);
    if (dirPath.startsWith('/home/')) {
      fullPath = path.join(os.homedir(), dirPath.replace('/home/', ''));
    } else if (dirPath.startsWith('~')) {
      fullPath = path.join(os.homedir(), dirPath.slice(1));
    }
    const files = fs.readdirSync(fullPath);
    return files.map(f => {
      const fullFilePath = path.join(fullPath, f);
      const stat = fs.statSync(fullFilePath);
      return { name: f, isDirectory: stat.isDirectory(), size: stat.size };
    });
  }

  async readFile(filePath) {
    const fullPath = path.resolve(filePath);
    return fs.readFileSync(fullPath, 'utf-8');
  }

  async getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      hostname: os.hostname(),
      homedir: os.homedir(),
      uptime: `${(os.uptime() / 60 / 60).toFixed(2)} hours`,
    };
  }

  async takeScreenshot() {
    const screenshotPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
    if (process.platform === 'win32') {
      const scriptPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.ps1`);
      const script = `Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$primary = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds = $primary.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
$bmp.Save('${screenshotPath.replace(/\\/g, '\\\\')}')
$g.Dispose()
$bmp.Dispose()`;
      fs.writeFileSync(scriptPath, script, 'utf8');
      const result = await this.execute(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
      console.log('[SCREENSHOT]', result);
      try { fs.unlinkSync(scriptPath); } catch (e) {}
    }
    return screenshotPath;
  }
}

module.exports = new SystemController();
