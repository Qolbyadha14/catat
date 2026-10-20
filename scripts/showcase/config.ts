import { defineConfig } from './types';

const SHOWCASE_STORAGE_LIGHT = {
  catat_showcase_mode: 'true',
  theme: 'light',
};

const SHOWCASE_STORAGE_DARK = {
  catat_showcase_mode: 'true',
  theme: 'dark',
};

/**
 * Showcase Configuration for Catat Personal Finance Platform
 * Defines target views, device viewports, and interactions for portfolio presentation.
 */
export default defineConfig({
  baseUrl: process.env.APP_URL || 'http://localhost:5173',
  outputDir: 'assets/showcase',
  defaultDelayMs: 2200,

  items: [
    // 1. Login View - Desktop Retina
    {
      name: '01_login_desktop_retina.png',
      route: '/',
      device: 'desktop-retina',
      tags: ['login', 'desktop', 'light'],
      localStorage: { theme: 'light' },
      delayMs: 1800,
    },

    // 2. Login View - Mobile iPhone (Light)
    {
      name: '02_login_mobile_iphone.png',
      route: '/',
      device: 'mobile-iphone',
      tags: ['login', 'mobile', 'light'],
      localStorage: { theme: 'light' },
      delayMs: 1800,
    },

    // 3. Login View - Mobile iPhone (Dark)
    {
      name: '03_login_mobile_dark.png',
      route: '/?theme=dark',
      device: 'mobile-iphone',
      tags: ['login', 'mobile', 'dark'],
      localStorage: { theme: 'dark' },
      delayMs: 1800,
    },

    // 4. Beranda / Home Dashboard - Mobile (Light)
    {
      name: '04_dashboard_beranda_mobile.png',
      route: '/?demo=true&theme=light',
      device: 'mobile-iphone',
      tags: ['dashboard', 'beranda', 'mobile', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
    },

    // 5. Beranda / Home Dashboard - Mobile (Dark)
    {
      name: '05_dashboard_beranda_dark.png',
      route: '/?demo=true&theme=dark',
      device: 'mobile-iphone',
      tags: ['dashboard', 'beranda', 'mobile', 'dark'],
      localStorage: SHOWCASE_STORAGE_DARK,
      delayMs: 2500,
    },

    // 6. Dompet & PayLater - Mobile (Light)
    {
      name: '06_dashboard_dompet_mobile.png',
      route: '/?demo=true&theme=light',
      device: 'mobile-iphone',
      tags: ['dashboard', 'dompet', 'mobile', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
      action: async (page) => {
        await page.click('button[aria-label="Dompet & PayLater"]');
        await new Promise((r) => setTimeout(r, 600));
      },
    },

    // 7. Dompet & PayLater - Mobile (Dark)
    {
      name: '07_dashboard_dompet_dark.png',
      route: '/?demo=true&theme=dark',
      device: 'mobile-iphone',
      tags: ['dashboard', 'dompet', 'mobile', 'dark'],
      localStorage: SHOWCASE_STORAGE_DARK,
      delayMs: 2500,
      action: async (page) => {
        await page.click('button[aria-label="Dompet & PayLater"]');
        await new Promise((r) => setTimeout(r, 600));
      },
    },

    // 8. Anggaran Bulanan - Mobile (Light)
    {
      name: '08_dashboard_anggaran_mobile.png',
      route: '/?demo=true',
      device: 'mobile-iphone',
      tags: ['dashboard', 'anggaran', 'mobile', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
      action: async (page) => {
        await page.click('button[aria-label="Anggaran Bulanan"]');
        await new Promise((r) => setTimeout(r, 600));
      },
    },

    // 9. Statistik & Donut / Bar Charts - Mobile (Light)
    {
      name: '09_dashboard_statistik_mobile.png',
      route: '/?demo=true',
      device: 'mobile-iphone',
      tags: ['dashboard', 'statistik', 'mobile', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
      action: async (page) => {
        await page.click('button[aria-label="Statistik & Analisis"]');
        await new Promise((r) => setTimeout(r, 800));
      },
    },

    // 10. AI Receipt Scan / OCR Modal - Mobile (Light)
    {
      name: '10_modal_scan_struk_ai.png',
      route: '/?demo=true',
      device: 'mobile-iphone',
      tags: ['modal', 'ocr', 'mobile', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
      action: async (page) => {
        await page.click('button[aria-label="Catat Transaksi Baru"]');
        await new Promise((r) => setTimeout(r, 600));
      },
    },

    // 11. Catat Transaksi Manual Form - Mobile (Light)
    {
      name: '11_modal_transaksi_manual.png',
      route: '/?demo=true',
      device: 'mobile-iphone',
      tags: ['modal', 'transaksi', 'mobile', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
      action: async (page) => {
        await page.click('button[aria-label="Catat Transaksi Baru"]');
        await new Promise((r) => setTimeout(r, 400));
        await page.clickByText('button', 'Manual');
        await new Promise((r) => setTimeout(r, 600));
      },
    },

    // 12. Desktop Full Overview (Retina Frame)
    {
      name: '12_desktop_overview_retina.png',
      route: '/?demo=true',
      device: 'desktop-retina',
      tags: ['desktop', 'overview', 'light'],
      localStorage: SHOWCASE_STORAGE_LIGHT,
      delayMs: 2500,
    },
  ],
});
