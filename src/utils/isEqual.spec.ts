import { isEqual } from './isEqual';
import { test, expect } from 'vitest';

test(isEqual, () => {
    expect(isEqual('', '')).toBe(true);
    expect(isEqual(0, 0)).toBe(true);
    expect(isEqual(Infinity, Infinity)).toBe(true);

    expect(isEqual('', 0)).toBe(false);

    expect(isEqual({}, {})).toBe(true);
    expect(isEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(isEqual({ a: { a: 1 } }, { a: { a: 1 } })).toBe(true);

    expect(isEqual([], [])).toBe(true);

    expect(isEqual([1], [2])).toBe(false);
    expect(isEqual([1], [1, 2])).toBe(false);
    expect(isEqual([1, 2], [2, 1])).toBe(false);

    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqual({ a: 1 }, {})).toBe(false);
    expect(isEqual({}, { a: 1 })).toBe(false);
    expect(isEqual({ a: { a: 1 } }, { a: { a: 2 } })).toBe(false);
    expect(isEqual({ a: 1 }, { a: 1, b: 1 })).toBe(false);
});
