import type * as v from 'valibot';

export function isSchema(schema: any): boolean {
    return schema?.type;
}

export function isOptionalSchema(schema: any): schema is v.OptionalSchema<any> {
    return schema?.type === 'optional';
}

export function isStringSchema(schema: any): schema is v.StringSchema<any> {
    return schema?.type === 'string';
}
