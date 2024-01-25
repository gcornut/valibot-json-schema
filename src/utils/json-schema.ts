import { assert } from './assert';

/** JSON Schema URI */
export const $schema = 'http://json-schema.org/draft-07/schema#';

/** Check value is a JSON literal */
export function isJSONLiteral(value: any): value is string | number | boolean | null {
    return (typeof value === 'number' && !Number.isNaN(value)) || typeof value === 'string' || typeof value === 'boolean' || value === null;
}

/** Assert value is a JSON literal */
export const assertJSONLiteral = (v: any) => assert(v, isJSONLiteral, 'Unsupported literal value type: %');
