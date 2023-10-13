export type Predicate<V, A extends V = any> = ((v: V) => v is A) | ((v: V) => boolean);
export type Not<T, R> = R extends T ? never : R;

export function and<A, B>(p1: Predicate<any, A>, p2: Predicate<any, B>) {
    return ((v) => p1(v) && p2(v)) as Predicate<any, A & B>;
}

export function or<A, B>(p1: Predicate<any, A>, p2: Predicate<any, B>) {
    return ((v) => p1(v) || p2(v)) as Predicate<any, A | B>;
}

export function negate<A, B>(p: Predicate<any, A>) {
    return ((v) => !p(v)) as Predicate<any>;
}
