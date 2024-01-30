import { JSONSchema7 } from 'json-schema';
import { BaseSchema, BaseSchemaAsync } from 'valibot';
import { ValueOf } from '../utils/ValueOf.js';
import { SupportedSchemas } from './schemas.js';

export const DateStrategy = {
    string: 'string',
    integer: 'integer',
} as const;
export type DateStrategy = ValueOf<typeof DateStrategy>;

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
     * 'integer' sets the type to 'integer' and format to 'unix-time'.
     * 'string' sets the type to 'string' and format to 'date-time'.
     */
    dateStrategy?: DateStrategy;
}

export interface Context extends Pick<ToJSONSchemaOptions, 'strictObjectTypes' | 'dateStrategy'> {
    /**
     * Mapping from schema to name
     */
    defNameMap: DefinitionNameMap;
}

export type DefinitionNameMap = Map<SupportedSchemas, string>;

export type BaseConverter = (schema: SupportedSchemas) => JSONSchema7;
