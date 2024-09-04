import type { JSONSchema7 } from 'json-schema';
import type { BaseMetadata } from 'valibot';

export interface JsonSchemaMetadataAction extends BaseMetadata<any> {
    type: '@gcornut/to-json-schema/json_schema_metadata';
    metadata: JSONSchema7;
}

export function jsonSchemaMetadata(metadata: JSONSchema7): JsonSchemaMetadataAction {
    return {
        kind: 'metadata',
        type: '@gcornut/to-json-schema/json_schema_metadata',
        reference: jsonSchemaMetadata,
        metadata,
    };
}
