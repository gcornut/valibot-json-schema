import type { DescriptionAction } from 'valibot';
import type { ValidationConverter } from '../types';

export type SupportedMetadata = DescriptionAction<any, any>;

export const METADATA_BY_TYPE: {
    [K in SupportedMetadata['type']]: ValidationConverter<Extract<SupportedMetadata, { type: K }>>;
} = {
    description: ({ description }) => ({ description }),
};
