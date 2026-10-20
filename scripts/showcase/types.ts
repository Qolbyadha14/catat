/**
 * Showcase Automation Framework - Types & Interfaces
 * Designed for zero-dependency portability across any web application project.
 */

export type DevicePresetName =
  | 'desktop-retina'
  | 'desktop-wide'
  | 'desktop-4k'
  | 'laptop'
  | 'mobile-iphone'
  | 'mobile-android'
  | 'tablet-ipad';

export interface DeviceViewport {
  width: number;
  height: number;
  scale: number;
  mobile: boolean;
  userAgent?: string;
}

export interface CdpPageInterface {
  send(method: string, params?: any): Promise<any>;
  evaluate(expression: string, awaitPromise?: boolean): Promise<any>;
  waitForFonts(): Promise<void>;
  click(selector: string): Promise<boolean>;
  clickByText(selector: string, textMatch: string): Promise<boolean>;
  scrollTo(y: number): Promise<void>;
  close(): void;
}

export type ShowcaseAction = (page: CdpPageInterface) => Promise<void>;

export interface ShowcaseItem {
  /** Output file name (e.g. '01_landing_hero.png') */
  name: string;
  /** Relative route (e.g. '/' or '/dashboard') or full URL */
  route: string;
  /** Preset device viewport or custom dimensions */
  device?: DevicePresetName;
  /** Custom viewport overrides */
  customViewport?: Partial<DeviceViewport>;
  /** Delay in milliseconds before capture (default: 2500ms) */
  delayMs?: number;
  /** Category tags for filtering via CLI (e.g. ['public', 'mobile', 'admin']) */
  tags?: string[];
  /** Optional custom interaction (click buttons, fill input, toggle tabs) */
  action?: ShowcaseAction;
  /** Inject localStorage keys prior to page load */
  localStorage?: Record<string, string>;
}

export interface ShowcaseConfig {
  /** Target base application URL (e.g. 'http://localhost:3000' or staging URL) */
  baseUrl?: string;
  /** Destination directory for output screenshots (default: 'assets/showcase') */
  outputDir?: string;
  /** Remote debugging port for headless Chrome (default: 9222) */
  cdpPort?: number;
  /** Global delay buffer applied to all items (ms) */
  defaultDelayMs?: number;
  /** List of screenshot capture items */
  items: ShowcaseItem[];
}

export interface CaptureResult {
  name: string;
  route: string;
  device: string;
  sizeKb: number;
  success: boolean;
  durationMs: number;
  error?: string;
}

/** Helper function to provide IDE autocompletion when defining config */
export function defineConfig(config: ShowcaseConfig): ShowcaseConfig {
  return config;
}
