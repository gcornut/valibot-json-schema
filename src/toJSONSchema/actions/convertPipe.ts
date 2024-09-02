import type { JSONSchema7 } from 'json-schema';
import type { PipeItem } from 'valibot';

import { assert } from '../../utils/assert';
import type { PipeSchema } from '../schemas';
import type { Context, ValidationConverter } from '../types';

import { METADATA_BY_TYPE, type SupportedMetadata } from './metadata';
import { type SupportedValidation, VALIDATION_BY_SCHEMA } from './validations';

/**
 * Convert a validation pipe to JSON schema.
 */
export function convertPipe(
    schemaType: keyof typeof VALIDATION_BY_SCHEMA,
    pipe: PipeSchema['pipe'] | undefined,
    context: Context,
): JSONSchema7 {
    const [schema, ...pipeItems] = pipe || [];
    if (!schema) return {};

    // Convert child schema pipe
    const childPipe = convertPipe(schemaType, (schema as any)?.pipe, context);

    function convertPipeItem(def: JSONSchema7, validation: PipeItem<any, any, any>) {
        const validationType = validation.type;
        const validationConverter =
            context.customValidationConversion?.[schemaType]?.[validationType] ||
            VALIDATION_BY_SCHEMA[schemaType]?.[validationType as SupportedValidation['type']] ||
            METADATA_BY_TYPE[validationType as SupportedMetadata['type']];

        if (!validationConverter && context.ignoreUnknownValidation) return {};
        assert(validationConverter, Boolean, `Unsupported valibot validation \`${validationType}\` for schema \`${schemaType}\``);

        const converted = (validationConverter as ValidationConverter<any>)(validation, context);
        return Object.assign(def, converted);
    }

    // Convert pipe items
    return pipeItems.reduce(convertPipeItem, childPipe);
}
