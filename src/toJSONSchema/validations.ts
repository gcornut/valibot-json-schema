import { JSONSchema7 } from 'json-schema';
import {
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
import { SupportedSchemas } from './schemas';

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

type ValidationConverter<V extends SupportedValidation> = (validation: V) => JSONSchema7;

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
};

/**
 * Convert a validation pipe to JSON schema.
 */
export function convertPipe(schemaType: keyof typeof VALIDATION_BY_SCHEMA, pipe: Pipe<any> = []): JSONSchema7 | undefined {
    return pipe.reduce((def, validation) => {
        const validationType = (validation as SupportedValidation).type;
        const validationConverter = VALIDATION_BY_SCHEMA[schemaType]?.[validationType] as ValidationConverter<any>;
        assert(validationConverter, Boolean, `Unsupported valibot validation \`${validationType}\` for schema \`${schemaType}\``);
        return Object.assign(def, validationConverter(validation));
    }, {} as JSONSchema7);
}
