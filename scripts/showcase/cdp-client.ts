import { CdpPageInterface, DeviceViewport } from './types';

interface CdpMessage {
  id: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

/**
 * Lightweight, zero-dependency Chrome DevTools Protocol Client using native WebSockets.
 */
export class CdpClient {
  protected ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(e);
      this.ws.onmessage = (event) => {
        try {
          const msg: CdpMessage = JSON.parse(event.data.toString());
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch (err) {
          console.error('[CDP] Message parsing error:', err);
        }
      };
    });
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

/**
 * Represents a single page / tab session attached via CDP.
 */
export class CdpPage extends CdpClient implements CdpPageInterface {
  async init(): Promise<void> {
    await this.ready();
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  async setViewport(viewport: DeviceViewport): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.scale,
      mobile: viewport.mobile,
    });
    if (viewport.userAgent) {
      await this.send('Network.setUserAgentOverride', {
        userAgent: viewport.userAgent,
      });
    }
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  async evaluate(expression: string, awaitPromise = true): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  async waitForFonts(): Promise<void> {
    try {
      await this.evaluate('document.fonts.ready', true);
    } catch {}
  }

  async click(selector: string): Promise<boolean> {
    return this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (el) { el.click(); return true; }
        return false;
      })()
    `);
  }

  async clickByText(selector: string, textMatch: string): Promise<boolean> {
    return this.evaluate(`
      (() => {
        const elements = Array.from(document.querySelectorAll('${selector}'));
        const target = elements.find(el => el.innerText && el.innerText.toLowerCase().includes('${textMatch.toLowerCase()}'));
        if (target) {
          target.click();
          return true;
        }
        return false;
      })()
    `);
  }

  async scrollTo(y: number): Promise<void> {
    await this.evaluate(`window.scrollTo({ top: ${y}, behavior: 'smooth' })`);
  }

  async injectLocalStorage(entries: Record<string, string>): Promise<void> {
    const json = JSON.stringify(entries);
    await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        try {
          const entries = ${json};
          for (const [k, v] of Object.entries(entries)) {
            localStorage.setItem(k, v);
          }
        } catch (e) {}
      `,
    });
  }

  async captureScreenshot(options?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<string> {
    const result = await this.send('Page.captureScreenshot', {
      format: options?.format || 'png',
      quality: options?.quality,
      fromSurface: true,
    });
    return result.data; // Base64 encoded string
  }
}
