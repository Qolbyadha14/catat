import { resolveTheme } from './theme';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Light explicit
assert(resolveTheme('light', false) === 'light', 'light + false -> light');
assert(resolveTheme('light', true) === 'light', 'light + true -> light');

// Dark explicit
assert(resolveTheme('dark', false) === 'dark', 'dark + false -> dark');
assert(resolveTheme('dark', true) === 'dark', 'dark + true -> dark');

// System / null / undefined fallback to prefersDark
assert(resolveTheme('system', false) === 'light', 'system + false -> light');
assert(resolveTheme('system', true) === 'dark', 'system + true -> dark');
assert(resolveTheme(null, false) === 'light', 'null + false -> light');
assert(resolveTheme(null, true) === 'dark', 'null + true -> dark');
assert(resolveTheme(undefined, false) === 'light', 'undefined + false -> light');
assert(resolveTheme(undefined, true) === 'dark', 'undefined + true -> dark');

console.log('resolveTheme asserts pass');
