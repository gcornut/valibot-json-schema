/** Minimal recursive deep equal of JS values */
export function isEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 === 'object' && typeof obj2 === 'object') {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) return false;
        return keys1.every((key1) => isEqual(obj1[key1], obj2[key1]));
    }
    return false;
}
