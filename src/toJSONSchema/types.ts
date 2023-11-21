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
    strictObjectTypes?: boolean
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
}

export type DefinitionNameMap = Map<SupportedSchemas, string>;

export type BaseConverter = (schema: SupportedSchemas) => JSONSchema7;
