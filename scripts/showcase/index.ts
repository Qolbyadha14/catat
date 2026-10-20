import { resolve } from 'path';
import { existsSync } from 'fs';
import { executeShowcaseEngine } from './engine';
import { ShowcaseConfig } from './types';

function parseArgs(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

function printHelp() {
  console.log(`
Usage: bun run scripts/showcase [options]

Options:
  --config <path>    Path to config file (default: showcase.config.ts)
  --url <url>        Override target Base URL (e.g. http://localhost:3000)
  --out <dir>        Override destination directory (default: assets/showcase)
  --only <keyword>   Filter items matching keyword in name or route
  --tag <tag>        Filter items matching specific tag (e.g. mobile, admin)
  --device <preset>  Filter items by device (e.g. mobile, desktop)
  --list             List all configured items without running capture
  --help             Show this help message

Examples:
  bun run scripts/showcase
  bun run scripts/showcase --only landing
  bun run scripts/showcase --tag mobile
  bun run scripts/showcase --url https://staging.myapp.com
`);
}

export async function main() {
  const args = process.argv.slice(2);
  const flags = parseArgs(args);

  if (flags['help']) {
    printHelp();
    return;
  }

  const customConfig = typeof flags['config'] === 'string' ? flags['config'] : undefined;
  const meta = import.meta as { dir?: string; main?: boolean };
  const currentDir = typeof meta.dir === 'string' ? meta.dir : resolve('scripts/showcase');
  const candidates = [
    customConfig ? resolve(customConfig) : null,
    resolve(currentDir, 'config.ts'),
    resolve(currentDir, 'showcase.config.ts'),
    resolve('scripts/showcase/config.ts'),
    resolve('showcase.config.ts'),
  ].filter(Boolean) as string[];

  const configPath = candidates.find((p) => existsSync(p));

  if (!configPath) {
    console.error(`\n[Error] Configuration file not found.`);
    console.error(`Searched locations:\n  - ${candidates.join('\n  - ')}\n`);
    console.error('Please create a config.ts inside scripts/showcase/.\n');
    process.exit(1);
  }

  // Load config dynamically
  const imported = await import(configPath);
  const config: ShowcaseConfig = imported.default || imported;

  if (flags['list']) {
    console.log(`\nConfigured Showcase Items in (${configPath}):`);
    config.items.forEach((item, idx) => {
      console.log(
        `  ${(idx + 1).toString().padStart(2, ' ')}. [${item.name}] -> ${item.route} (${item.device || 'desktop-retina'}) tags: [${(item.tags || []).join(', ')}]`
      );
    });
    console.log();
    return;
  }

  await executeShowcaseEngine({
    config,
    baseUrlOverride: typeof flags['url'] === 'string' ? flags['url'] : undefined,
    outputDirOverride: typeof flags['out'] === 'string' ? flags['out'] : undefined,
    filterQuery: typeof flags['only'] === 'string' ? flags['only'] : undefined,
    tagFilter: typeof flags['tag'] === 'string' ? flags['tag'] : undefined,
    deviceFilter: typeof flags['device'] === 'string' ? flags['device'] : undefined,
  });
}

// Execute if run directly
const meta = import.meta as { main?: boolean };
if (meta.main || process.argv[1]?.endsWith('showcase/index.ts')) {
  main().catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}
