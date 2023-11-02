import type * as v from 'valibot';

export function isSchema(schema: any): boolean {
    return schema?.type;
}

type KnownSchemas = v.OptionalSchema<any> | v.StringSchema | v.NeverSchema;
type GetSchema<T extends string> = Extract<KnownSchemas, { type: T }>

export const isSchemaType = <T extends KnownSchemas['type']>(type: T) => {
    return (schema: any): schema is GetSchema<T> => !!schema && schema.type === type;
};

export const isOptionalSchema = isSchemaType('optional');
export const isStringSchema = isSchemaType('string');
export const isNeverSchema = isSchemaType('never');
