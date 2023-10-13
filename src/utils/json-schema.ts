/** JSON Schema URI */
export const $schema = 'http://json-schema.org/draft-07/schema#';

/** Check value is a JSON literal */
export function isJSONLiteral(value: any): value is string | number | boolean | null {
    return (typeof value === 'number' && !Number.isNaN(value)) || (typeof value === 'string') || typeof value === 'boolean' || typeof value === null;
}
