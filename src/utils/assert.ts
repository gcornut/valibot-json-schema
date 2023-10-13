import type { Predicate } from './predicate';

export function assert<V>(value: V, predicate: Predicate<V>, message: string) {
    if (!predicate(value)) throw new Error(message.replace('%', String(value)));
    return value;
}
