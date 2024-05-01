import type { JSONSchema7 } from 'json-schema';
import type { BaseSchema, BaseSchemaAsync, BaseValidation } from 'valibot';
import type { ValueOf } from '../utils/ValueOf';
import type { SupportedSchemas } from './schemas';
import { SupportedValidation } from './validations';

export const DateStrategy = {
    string: 'string',
    integer: 'integer',
} as const;
export type DateStrategy = ValueOf<typeof DateStrategy>;

export const UndefinedStrategy = {
    any: 'any',
    null: 'null',
} as const;
export type UndefinedStrategy = ValueOf<typeof UndefinedStrategy>;

export const BigIntStrategy = {
    string: 'string',
    integer: 'integer',
} as const;
export type BigIntStrategy = ValueOf<typeof BigIntStrategy>;

export interface ToJSONSchemaOptions {
    /**
     * Main schema (referenced at the root of the JSON schema).
     */
    schema?: BaseSchema | BaseSchemaAsync;
    /**
     * Additional schemas (referenced in the JSON schema `definitions`).
     */
    definitions?: Record<string, SupportedSchemas>;
    /**
     * Make all object type strict (`additionalProperties: false`).
     */
    strictObjectTypes?: boolean;
    /**
     * Date output:
     * - 'integer' sets the type to 'integer' and format to 'unix-time'.
     * - 'string' sets the type to 'string' and format to 'date-time'.
     */
    dateStrategy?: DateStrategy;
    /**
     * Undefined output:
     * - 'any' output an empty schema (the "any" schema)
     * - 'null' sets the type to 'null'
     */
    undefinedStrategy?: UndefinedStrategy;
    /**
     * How bigint schema should be converted:
     * - 'integer': uses integer type with format 'int64' (see https://ajv.js.org/packages/ajv-formats.html#formats)
     * - 'string': uses string type
     */
    bigintStrategy?: BigIntStrategy;
    /**
     * If true, do not throw an error on validations that cannot be
     * converted to JSON schema, like `custom`.
     */
    ignoreUnknownValidation?: boolean;
    /**
     * Customize how valibot schemas of the given type are converted to JSON schema.
     *
     * @example
     *   // Make valibot `instance()` schema convert to the "any" JSON schema (no validation)
     *   { customSchemaConversion: { instance: () => ({}) }  }
     */
    customSchemaConversion?: { [schemaType: string]: SchemaConverter<BaseSchema> };
    /**
     * Customize how valibot validations of the given type are converted to JSON schema.
     *
     * @example
     *   // Make valibot `custom()` validation in object schema convert to the "any" JSON schema (no validation)
     *   { customValidationConversion: { object: { custom: () => ({}) }  } }
     */
    customValidationConversion?: { [schemaType: string]: { [validationType: string]: ValidationConverter<BaseValidation> } };
}

export interface Context extends Omit<ToJSONSchemaOptions, 'schema' | 'definitions'> {
    /**
     * Mapping from schema to name
     */
    defNameMap: DefinitionNameMap;
}

export type DefinitionNameMap = Map<SupportedSchemas, string>;

export type BaseConverter = (schema: SupportedSchemas) => JSONSchema7;

export type SchemaConverter<S extends BaseSchema> = (schema: S, convert: BaseConverter, context: Context) => JSONSchema7;

export type ValidationConverter<V extends BaseValidation> = (validation: V, context: Context) => JSONSchema7;
