# @gcornut/valibot-json-schema

Work in progress:

- [x] Base types (any, null, string, etc.)
- [x] Composition types (enum, union, intersection, etc.)
- [x] Object & array types
- [x] Recursive types
- [x] Definitions index
- [ ] Record & tuple types
- [ ] Globally strict object types (`additionalProperties: false`).
- [ ] CLI `npx @gcornut/valibot-json-schema to-json --path ./schemas.ts`
- [ ] NPM package
- [ ] Write more documentation
- [ ] Extension system to fix the limitations on unsupported Valibot features (
  handle `strict`, `maxLength`, `minLength`, etc.)

## Convert Valibot to JSON Schema

Use the `toJSONSchema` function to convert a Valibot schema into JSON schema (v7).

```js
import { toJSONSchema } from '@gcornut/valibot-json-schema/toJSONSchema';
import { string } from 'valibot';

toJSONSchema(string())
/**
 * Returns:
 * {
 *    $schema: 'http://json-schema.org/draft-07/schema#',
 *    type: 'string',
 * }
 */
```

Some of the features of Valibot can't be converted to JSON schema. JS-specific types like `blob` or `nan` obviously
can't have an equivalent.
Also, Valibot pipelines (like `maxLength`, `regex`, etc.) can't easily be introspected and thus can't be converted even
if they have an equivalent in JSON schema.

### JSON Schema definitions

To provide name for your schema and have them indexed in the JSON schema definitions, you need to provide your schemas
in the `definitions` option of the `toJSONSchema` function.

```js
import { toJSONSchema } from '@gcornut/valibot-json-schema/toJSONSchema';
import { number } from 'valibot';

const Number = number();
toJSONSchema(Number, { definitions: { Number } });
/**
 * Returns:
 * {
 *    $schema: 'http://json-schema.org/draft-07/schema#',
 *    $ref: '#/definitions/Number',
 *    definitions: { Number: { type: 'number' } },
 * }
 */
```

### Supported features

<details>
<summary>Supported schemas</summary>

|                | status                                                                                      |
|----------------|---------------------------------------------------------------------------------------------|
| `any`          | supported                                                                                   |
| `null`         | supported                                                                                   |
| `literal`      | partial: only JSON literal are supported                                                    |
| `number`       | supported                                                                                   |
| `string`       | supported                                                                                   |
| `boolean`      | supported                                                                                   |
| `nullable`     | supported                                                                                   |
| `optional`     | partial: only inside `object` schema                                                        |
| `enum`         | supported                                                                                   |
| `union`        | supported                                                                                   |
| `intersection` | supported                                                                                   |
| `array`        | supported                                                                                   |
| `object`       | supported                                                                                   |
| `recursive`    | partial: only if the schema inside [is referenced in `definitions`](#jsonchema-definitions) |

</details>
