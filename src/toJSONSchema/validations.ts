import type { JSONSchema7 } from 'json-schema';
import type {
    EmailValidation,
    IntegerValidation,
    Ipv4Validation,
    Ipv6Validation,
    IsoDateValidation,
    IsoTimestampValidation,
    LengthValidation,
    MaxLengthValidation,
    MaxValueValidation,
    MinLengthValidation,
    MinValueValidation,
    MultipleOfValidation,
    Pipe,
    RegexValidation,
    UuidValidation,
    ValueValidation,
} from 'valibot';
import { assert } from '../utils/assert';
import type { SupportedSchemas } from './schemas';
import type { Context, ValidationConverter } from './types';

export type SupportedValidation =
    | LengthValidation<any, any>
    | MaxLengthValidation<any, any>
    | MinLengthValidation<any, any>
    | RegexValidation<any>
    | ValueValidation<any, any>
    | MinValueValidation<any, any>
    | MaxValueValidation<any, any>
    | MultipleOfValidation<any, any>
    | IntegerValidation<any>
    | IsoDateValidation<any>
    | IsoTimestampValidation<any>
    | Ipv4Validation<any>
    | Ipv6Validation<any>
    | UuidValidation<any>
    | EmailValidation<any>;

const VALIDATION_BY_SCHEMA: {
    [schema in SupportedSchemas['type']]?: {
        [K in SupportedValidation['type']]?: ValidationConverter<Extract<SupportedValidation, { type: K }>>;
    };
} = {
    array: {
        length: ({ requirement }) => ({ minItems: requirement, maxItems: requirement }),
        min_length: ({ requirement }) => ({ minItems: requirement }),
        max_length: ({ requirement }) => ({ maxItems: requirement }),
    },
    string: {
        value: ({ requirement }) => ({ const: requirement }),
        length: ({ requirement }) => ({ minLength: requirement, maxLength: requirement }),
        min_length: ({ requirement }) => ({ minLength: requirement }),
        max_length: ({ requirement }) => ({ maxLength: requirement }),
        // TODO: validate RegExp features are compatible with json schema ?
        regex: ({ requirement }) => ({ pattern: requirement.source }),
        email: () => ({ format: 'email' }),
        iso_date: () => ({ format: 'date' }),
        iso_timestamp: () => ({ format: 'date-time' }),
        ipv4: () => ({ format: 'ipv4' }),
        ipv6: () => ({ format: 'ipv6' }),
        uuid: () => ({ format: 'uuid' }),
    },
    number: {
        value: ({ requirement }) => ({ const: requirement }),
        min_value: ({ requirement }) => ({ minimum: requirement }),
        max_value: ({ requirement }) => ({ maximum: requirement }),
        multiple_of: ({ requirement }) => ({ multipleOf: requirement }),
        integer: () => ({ type: 'integer' }),
    },
    boolean: {
        value: ({ requirement }) => ({ const: requirement }),
    },
    date: {
        value: ({ requirement }, context) => ({ const: asDateRequirement('value', requirement, context) }),
        min_value: ({ requirement }, context) => ({ minimum: asDateRequirement('minValue', requirement, context) }),
        max_value: ({ requirement }, context) => ({ maximum: asDateRequirement('maxValue', requirement, context) }),
    },
};

function asDateRequirement(type: 'value' | 'minValue' | 'maxValue', requirement: any, context: Context) {
    assert(requirement, () => context.dateStrategy === 'integer', `${type} validation is only available with 'integer' date strategy`);
    assert(requirement, (r) => r instanceof Date, `Non-date value used for ${type} validation`);
    return requirement.getTime();
}

/**
 * Convert a validation pipe to JSON schema.
 */
export function convertPipe(schemaType: keyof typeof VALIDATION_BY_SCHEMA, pipe: Pipe<any>, context: Context): JSONSchema7 | undefined {
    return pipe.reduce((def, validation) => {
        const validationType = (validation as SupportedValidation).type;
        const validationConverter =
            context.customValidationConversion?.[schemaType]?.[validationType] || VALIDATION_BY_SCHEMA[schemaType]?.[validationType];

        if (!validationConverter && context.ignoreUnknownValidation) return {};

        assert(validationConverter, Boolean, `Unsupported valibot validation \`${validationType}\` for schema \`${schemaType}\``);
        const converted = (validationConverter as ValidationConverter<any>)(validation, context);
        return Object.assign(def, converted);
    }, {} as JSONSchema7);
}
