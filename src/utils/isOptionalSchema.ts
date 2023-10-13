import type * as v from 'valibot';

export function isOptionalSchema(schema: any): schema is v.OptionalSchema<any> {
    return schema.schema === 'optional';
}
