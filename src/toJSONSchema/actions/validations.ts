import type {
    EmailAction,
    IntegerAction,
    Ipv4Action,
    Ipv6Action,
    IsoDateAction,
    IsoTimestampAction,
    LengthAction,
    MaxLengthAction,
    MaxValueAction,
    MinLengthAction,
    MinValueAction,
    MultipleOfAction,
    RegexAction,
    UuidAction,
    ValueAction,
} from 'valibot';

import { assert } from '../../utils/assert';
import type { SupportedSchemas } from '../schemas';
import type { Context, ValidationConverter } from '../types';

export type SupportedValidation =
    | LengthAction<any, any, any>
    | MaxLengthAction<any, any, any>
    | MinLengthAction<any, any, any>
    | RegexAction<any, any>
    | ValueAction<any, any, any>
    | MinValueAction<any, any, any>
    | MaxValueAction<any, any, any>
    | MultipleOfAction<any, any, any>
    | IntegerAction<any, any>
    | IsoDateAction<any, any>
    | IsoTimestampAction<any, any>
    | Ipv4Action<any, any>
    | Ipv6Action<any, any>
    | UuidAction<any, any>
    | EmailAction<any, any>;

function asDateRequirement(type: 'value' | 'minValue' | 'maxValue', requirement: any, context: Context) {
    assert(requirement, () => context.dateStrategy === 'integer', `${type} validation is only available with 'integer' date strategy`);
    assert(requirement, (r) => r instanceof Date, `Non-date value used for ${type} validation`);
    return requirement.getTime();
}

export const VALIDATION_BY_SCHEMA: {
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
