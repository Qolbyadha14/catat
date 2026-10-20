import { describe, it, expect } from 'bun:test';
import { Header } from '../src/components/layout/Header';

describe('Header Component', () => {
  it('exports Header component cleanly', () => {
    expect(Header).toBeDefined();
  });
});
