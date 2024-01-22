import { SupportedSchemas } from './schemas';
import { JSONSchema7 } from 'json-schema';

export interface Options {
    /**
     * Main schema (referenced at the root of the JSON schema).
     */
    schema?: SupportedSchemas,
    /**
     * Additional schemas (referenced in the JSON schema `definitions`).
     */
    definitions?: Record<string, SupportedSchemas>;
    /**
     * Make all object type strict (`additionalProperties: false`).
     */
    strictObjectTypes?: boolean,
    /**
     * Date output:
     * 'integer' sets the type to 'integer' and format to 'unix-time'.
     * 'string' sets the type to 'string' and format to 'date-time'.
     */
    dateStrategy?: 'string' | 'integer'
}

export interface Context {
    /**
     * Mapping from schema to name
     */
    defNameMap: DefinitionNameMap;
    /**
     * Activate strict object types
     */
    strictObjectTypes?: Options['strictObjectTypes'];
    /**
     * Current date strategy
     */
    dateStrategy?: Options['dateStrategy']
}

export type DefinitionNameMap = Map<SupportedSchemas, string>;

export type BaseConverter = (schema: SupportedSchemas) => JSONSchema7;
