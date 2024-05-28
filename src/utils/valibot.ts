import type { GenericSchema, NeverSchema, NullishSchema, OptionalSchema, StringSchema } from 'valibot';

export function isSchema(schema: any): boolean {
    return schema?.type;
}

export function isSchemaType<T extends GenericSchema>(type: T['type']) {
    return (schema: GenericSchema): schema is T => {
        return !!schema && schema.type === type;
    };
}

export const isNullishSchema = isSchemaType<NullishSchema<any, any>>('nullish');
export const isOptionalSchema = isSchemaType<OptionalSchema<any, any>>('optional');
export const isStringSchema = isSchemaType<StringSchema<any>>('string');
export const isNeverSchema = isSchemaType<NeverSchema<any>>('never');
