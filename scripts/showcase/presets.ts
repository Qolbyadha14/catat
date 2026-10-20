import { DevicePresetName, DeviceViewport } from './types';

/**
 * Standardized high-fidelity device presets for portfolio and showcase screenshots.
 * All presets use Retina @2x or higher deviceScaleFactor for crisp presentation graphics.
 */
export const DEVICE_PRESETS: Record<DevicePresetName, DeviceViewport> = {
  // Modern MacBook / designer display resolution
  'desktop-retina': {
    width: 1440,
    height: 900,
    scale: 2,
    mobile: false,
  },
  // Full HD widescreen
  'desktop-wide': {
    width: 1920,
    height: 1080,
    scale: 1.5,
    mobile: false,
  },
  // Ultra high resolution 1440p
  'desktop-4k': {
    width: 2560,
    height: 1440,
    scale: 2,
    mobile: false,
  },
  // Compact laptop display
  'laptop': {
    width: 1280,
    height: 800,
    scale: 2,
    mobile: false,
  },
  // Modern iPhone (Pro Max / standard proportions)
  'mobile-iphone': {
    width: 414,
    height: 896,
    scale: 2,
    mobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  // Modern Android flagship
  'mobile-android': {
    width: 393,
    height: 852,
    scale: 2.5,
    mobile: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  },
  // iPad / tablet viewport
  'tablet-ipad': {
    width: 820,
    height: 1180,
    scale: 2,
    mobile: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
};
