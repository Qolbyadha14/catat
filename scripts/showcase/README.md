# Showcase Automation Toolkit

A lightweight, zero-dependency screenshot capture framework designed for creating high-resolution, Retina @2x portfolio and showcase graphics across any web application (Next.js, Vite, React, Vue, Svelte, or static sites).

---

## Key Features

1. **Zero External Dependencies**: Uses native Bun/Node 18+ WebSockets to communicate directly with Google Chrome DevTools Protocol (CDP). No heavy Puppeteer/Playwright packages required.
2. **Cross-Platform Auto-Detection**: Automatically discovers Chrome, Chromium, Brave, or Edge binaries on macOS, Linux (CI/CD), and Windows.
3. **Curated Device Presets**:
   - `desktop-retina`: 1440 x 900 @2x (signature modern MacBook screen)
   - `desktop-wide`: 1920 x 1080 @1.5x (Full HD)
   - `desktop-4k`: 2560 x 1440 @2x (ultra crisp presentation)
   - `laptop`: 1280 x 800 @2x
   - `mobile-iphone`: 414 x 896 @2x (iPhone Pro with mobile viewport & user agent)
   - `mobile-android`: 393 x 852 @2.5x (Pixel / modern Android)
   - `tablet-ipad`: 820 x 1180 @2x
4. **Reliable Web Font & Asset Rendering**: Automatically waits for `document.fonts.ready` and supports custom delay buffers so font flickers (FOUT) or unloaded images never appear in screenshots.
5. **Interactive Actions Support**: Click buttons (e.g. open modal, reveal envelope), pre-inject `localStorage` keys, or scroll to specific sections before taking the shot.

---

## Quick Start (In This Project)

### 1. List configured items
```bash
bun run scripts/showcase/index.ts --list
```

### 2. Capture all items
```bash
bun run scripts/capture_showcase.ts
```

### 3. Filter by keyword or tag
```bash
# Only capture items matching 'landing'
bun run scripts/capture_showcase.ts --only landing

# Only capture items tagged with 'mobile'
bun run scripts/capture_showcase.ts --tag mobile

# Override target Base URL (e.g. for staging or different port)
bun run scripts/capture_showcase.ts --url http://localhost:3000

# Override output folder
bun run scripts/capture_showcase.ts --out assets/portfolio
```

---

## How to Reuse in ANY Other Project

To copy and use this framework in another repository:

### Step 1: Copy the `scripts/showcase` folder
Copy the entire `scripts/showcase/` folder into your new project's `scripts/` directory:
```
my-other-project/
└── scripts/
    └── showcase/
        ├── config.ts          <-- Edit your routes/items here
        ├── types.ts
        ├── presets.ts
        ├── chrome-launcher.ts
        ├── cdp-client.ts
        ├── engine.ts
        ├── index.ts
        └── README.md
```

### Step 2: Edit `scripts/showcase/config.ts` for your new project
```typescript
import { defineConfig } from './types';

export default defineConfig({
  baseUrl: process.env.APP_URL || 'http://localhost:3000',
  outputDir: 'assets/showcase',
  defaultDelayMs: 2000,
  items: [
    {
      name: '01_homepage_hero.png',
      route: '/',
      device: 'desktop-retina',
      tags: ['public'],
    },
    {
      name: '02_mobile_navigation.png',
      route: '/',
      device: 'mobile-iphone',
      tags: ['mobile'],
      action: async (page) => {
        // Example: open hamburger menu before capture
        await page.click('button[aria-label="Menu"]');
        await new Promise((r) => setTimeout(r, 600));
      },
    },
    {
      name: '03_user_dashboard.png',
      route: '/dashboard',
      device: 'desktop-retina',
      tags: ['app'],
      localStorage: {
        'auth_token': 'dummy-mock-token-if-needed',
      },
    },
  ],
});
```

### Step 3: Run with Bun or Node
```bash
bun run scripts/showcase/index.ts
# or with Node 18+ tsx / ts-node:
npx tsx scripts/showcase/index.ts
```
