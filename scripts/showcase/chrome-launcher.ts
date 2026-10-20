import { existsSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';

/**
 * Discovers the Google Chrome / Chromium executable path across macOS, Linux, and Windows.
 */
export function resolveChromeBinaryPath(): string {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const progFiles86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    candidates.push(
      `${progFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${progFiles86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
      `${progFiles}\\Microsoft\\Edge\\Application\\msedge.exe`
    );
  } else {
    // Linux / CI environments
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Chrome executable not found on ${platform}. Please install Google Chrome or set CHROME_PATH environment variable.`
  );
}

export interface ChromeInstance {
  process: ChildProcess;
  wsEndpoint: string;
  close: () => void;
}

/**
 * Spawns a headless Chrome instance with DevTools Protocol enabled and returns WebSocket endpoint.
 */
export async function launchHeadlessChrome(port = 9222): Promise<ChromeInstance> {
  const binaryPath = resolveChromeBinaryPath();

  const profileDir = `/tmp/chrome-showcase-profile-${Date.now()}`;
  const chromeProcess: ChildProcess = spawn(
    binaryPath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profileDir}`,
    ],
    { stdio: 'ignore' }
  );

  const cleanup = () => {
    try {
      if (!chromeProcess.killed) chromeProcess.kill('SIGKILL');
    } catch {}
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  // Poll for CDP readiness
  let wsEndpoint = '';
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      if (res.ok) {
        const json = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (json.webSocketDebuggerUrl) {
          wsEndpoint = json.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {
      try {
        const resFallback = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (resFallback.ok) {
          const json = (await resFallback.json()) as { webSocketDebuggerUrl?: string };
          if (json.webSocketDebuggerUrl) {
            wsEndpoint = json.webSocketDebuggerUrl;
            break;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!wsEndpoint) {
    cleanup();
    throw new Error(`Failed to connect to Chrome DevTools on port ${port} within timeout`);
  }

  return {
    process: chromeProcess,
    wsEndpoint,
    close: cleanup,
  };
}
