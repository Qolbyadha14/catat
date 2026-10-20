import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { launchHeadlessChrome } from './chrome-launcher';
import { CdpClient, CdpPage } from './cdp-client';
import { DEVICE_PRESETS } from './presets';
import { ShowcaseConfig, ShowcaseItem, CaptureResult, DeviceViewport } from './types';

export interface EngineRunOptions {
  config: ShowcaseConfig;
  filterQuery?: string;
  tagFilter?: string;
  deviceFilter?: string;
  baseUrlOverride?: string;
  outputDirOverride?: string;
}

/**
 * Showcase Execution Engine
 * Runs screenshot capture tasks with full isolation and structured reporting.
 */
export async function executeShowcaseEngine(options: EngineRunOptions): Promise<CaptureResult[]> {
  const { config } = options;
  const baseUrl = (options.baseUrlOverride || config.baseUrl || process.env.APP_URL || 'http://localhost:3002').replace(
    /\/$/,
    ''
  );
  const outputDir = resolve(options.outputDirOverride || config.outputDir || 'assets/showcase');
  const port = config.cdpPort || 9222;
  const defaultDelay = config.defaultDelayMs ?? 2500;

  mkdirSync(outputDir, { recursive: true });

  // Filter items
  let targetItems: ShowcaseItem[] = [...config.items];

  if (options.filterQuery) {
    const q = options.filterQuery.toLowerCase();
    targetItems = targetItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.route.toLowerCase().includes(q)
    );
  }

  if (options.tagFilter) {
    const tag = options.tagFilter.toLowerCase();
    targetItems = targetItems.filter((item) => item.tags?.some((t) => t.toLowerCase() === tag));
  }

  if (options.deviceFilter) {
    const dev = options.deviceFilter.toLowerCase();
    targetItems = targetItems.filter((item) => (item.device || 'desktop-retina').toLowerCase().includes(dev));
  }

  if (targetItems.length === 0) {
    console.log('\n[Showcase] No capture items matched the specified criteria.');
    return [];
  }

  console.log(`\n======================================================`);
  console.log(` Showcase Capture Engine`);
  console.log(` Base URL   : ${baseUrl}`);
  console.log(` Output Dir : ${outputDir}`);
  console.log(` Queue      : ${targetItems.length} items`);
  console.log(`======================================================\n`);

  const chrome = await launchHeadlessChrome(port);
  const browserCdp = new CdpClient(chrome.wsEndpoint);
  await browserCdp.ready();

  const results: CaptureResult[] = [];

  try {
    for (let index = 0; index < targetItems.length; index++) {
      const item = targetItems[index];
      const startTime = Date.now();
      const presetKey = item.device || 'desktop-retina';
      const preset = DEVICE_PRESETS[presetKey] || DEVICE_PRESETS['desktop-retina'];

      const viewport: DeviceViewport = {
        ...preset,
        ...(item.customViewport || {}),
      };

      const fullUrl = item.route.startsWith('http')
        ? item.route
        : `${baseUrl}${item.route.startsWith('/') ? item.route : `/${item.route}`}`;

      const progress = `[${index + 1}/${targetItems.length}]`;
      console.log(`${progress} Capturing: ${item.name} (${presetKey}) -> ${fullUrl}`);

      let targetId = '';
      try {
        const createRes = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
        targetId = createRes.targetId;

        const pageWsUrl = `ws://localhost:${port}/devtools/page/${targetId}`;
        const page = new CdpPage(pageWsUrl);
        await page.init();

        // 1. Setup Device Metrics & User Agent
        await page.setViewport(viewport);

        const isDark = item.tags?.includes('dark') || item.localStorage?.theme === 'dark';
        try {
          await page.send('Emulation.setEmulatedMedia', {
            media: 'page',
            features: [{ name: 'prefers-color-scheme', value: isDark ? 'dark' : 'light' }],
          });
        } catch {}

        // 2. Pre-inject localStorage if required
        if (item.localStorage) {
          await page.injectLocalStorage(item.localStorage);
        }

        // 3. Navigate
        await page.navigate(fullUrl);

        // 4. Wait buffer + web fonts ready
        const waitDelay = item.delayMs ?? defaultDelay;
        await new Promise((r) => setTimeout(r, waitDelay));
        await page.waitForFonts();

        // 5. Execute custom action (e.g. click open, tab switch, scroll)
        if (item.action) {
          await item.action(page);
        }

        // Clean dev artifacts (Next.js portal overlay / badges) for production portfolio capture
        await page.evaluate(`(() => {
          document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
        })()`);

        // 6. Capture full surface screenshot
        const base64Data = await page.captureScreenshot({ format: 'png' });
        const filePath = resolve(outputDir, item.name);
        writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const sizeKb = Math.round((base64Data.length * 0.75) / 1024);
        const durationMs = Date.now() - startTime;

        results.push({
          name: item.name,
          route: item.route,
          device: presetKey,
          sizeKb,
          success: true,
          durationMs,
        });

        console.log(`   ✓ Saved: ${item.name} (${sizeKb} KB) in ${durationMs}ms`);

        page.close();
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        console.error(`   ✗ Error capturing ${item.name}:`, err.message || err);
        results.push({
          name: item.name,
          route: item.route,
          device: presetKey,
          sizeKb: 0,
          success: false,
          durationMs,
          error: err.message || String(err),
        });
      } finally {
        if (targetId) {
          try {
            await browserCdp.send('Target.closeTarget', { targetId });
          } catch {}
        }
      }
    }
  } finally {
    browserCdp.close();
    chrome.close();
  }

  // Print Summary Table
  printSummaryTable(results);
  return results;
}

function printSummaryTable(results: CaptureResult[]): void {
  console.log('\n======================================================');
  console.log(' Showcase Execution Summary');
  console.log('======================================================');
  console.log(
    'Status'.padEnd(8) +
      'File Name'.padEnd(46) +
      'Device'.padEnd(18) +
      'Size'.padEnd(12) +
      'Duration'
  );
  console.log('-'.repeat(90));

  let successCount = 0;
  for (const r of results) {
    if (r.success) successCount++;
    const status = r.success ? '  OK  ' : ' FAILED ';
    const size = r.success ? `${r.sizeKb} KB` : '-';
    const dur = `${(r.durationMs / 1000).toFixed(1)}s`;
    console.log(
      status.padEnd(8) +
        r.name.padEnd(46) +
        r.device.padEnd(18) +
        size.padEnd(12) +
        dur
    );
  }
  console.log('-'.repeat(90));
  console.log(`Total: ${successCount}/${results.length} succeeded.\n`);
}
