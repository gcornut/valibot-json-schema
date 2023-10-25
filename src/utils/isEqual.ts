export function isEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 === 'object' && typeof obj2 === 'object') {
        const entries1 = Object.entries(obj1);
        const entries2 = Object.entries(obj2);
        if (entries1.length !== entries2.length) return false;
        return entries1.every(([key1, value1]) => isEqual(value1, obj2[key1]));
    }
    return false;
}
