import type { DescriptionAction } from 'valibot';
import type { JsonSchemaMetadataAction } from '../../extension/jsonSchemaMetadata';
import type { ValidationConverter } from '../types';

export type SupportedMetadata = DescriptionAction<any, any> | JsonSchemaMetadataAction;

export const METADATA_BY_TYPE: {
    [K in SupportedMetadata['type']]: ValidationConverter<Extract<SupportedMetadata, { type: K }>>;
} = {
    description: ({ description }) => ({ description }),
    '@gcornut/to-json-schema/json_schema_metadata': ({ metadata }) => metadata,
};
