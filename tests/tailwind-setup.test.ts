import { describe, it, expect } from 'bun:test';
import packageJson from '../package.json';

describe('Dependencies setup', () => {
  it('should have tailwindcss and lucide-react in dependencies', () => {
    const deps = { ...packageJson.dependencies, ...(packageJson.devDependencies || {}) };
    expect(deps['lucide-react']).toBeDefined();
    expect(deps['tailwindcss'] || deps['@tailwindcss/vite']).toBeDefined();
  });
});
