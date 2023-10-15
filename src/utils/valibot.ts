import type * as v from 'valibot';

export function isSchema(schema: any): boolean {
    return schema?.schema;
}

export function isOptionalSchema(schema: any): schema is v.OptionalSchema<any> {
    return schema?.schema === 'optional';
}

export function isStringSchema(schema: any): schema is v.StringSchema<any> {
    return schema?.schema === 'string';
}
