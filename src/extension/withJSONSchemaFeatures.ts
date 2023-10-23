import type { BaseSchema } from 'valibot';
import type { JSONSchema7 } from 'json-schema';

const JSON_SCHEMA_FEATURES_KEY = '__json_schema_features';

export type JSONSchemaFeatures = Partial<JSONSchema7>;

export interface WithJSONSchemaFeatures {
    [JSON_SCHEMA_FEATURES_KEY]: JSONSchemaFeatures;
}

export function withJSONSchemaFeatures<S extends BaseSchema>(schema: S, features: JSONSchemaFeatures): S & WithJSONSchemaFeatures {
    return Object.assign(schema, { [JSON_SCHEMA_FEATURES_KEY]: features });
}

export function getJSONSchemaFeatures<S extends WithJSONSchemaFeatures | BaseSchema<any>>(schema: S): JSONSchemaFeatures | undefined {
    return (schema as any)[JSON_SCHEMA_FEATURES_KEY];
}
