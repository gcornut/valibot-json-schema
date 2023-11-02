# @gcornut/valibot-json-schema

Convert Valibot schemas exported from a JS or TS module into JSON schema:

```shell
# Convert valibot schemas defined in typescript
npx @gcornut/valibot-json-schema to-json-schema ./path/to/valibot-schemas.ts
```

Outputs a conversion of the Valibot schemas into JSON schema. If the default export is a Valibot schemas, it is used as
the root definition. Other exported Valibot schemas are exported in the <code>definitions</code> section.

<details><summary>Example</summary>

_File `./path/to/valibot-schemas.ts`_:

```js
import * as v from 'valibot';

export const AString = v.string();
const AnObject = v.object({ aString: AString });
export default AnObject;
```

_Previous command outputs_:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "AString": {
      "type": "string"
    }
  },
  "properties": {
    "aString": {
      "$ref": "#/definitions/AString"
    }
  },
  "required": [
    "aString"
  ],
  "type": "object"
}
```

`AnObject` is the default export in the source module, so it is converted as the root definition. `AString` is exported
separately , so it is exported to the `definitions` section.

</details>

Use `-o <file>` option to output the JSON schema to a file instead of `stdout`.

Use `-t <type>` option to ignore the default export and use given exported type as the root definition.

Use `--strictObjectTypes` to generate strict object types that do not allow unknown
properties (`additionnalProperties: false`).

## Convert Valibot to JSON Schema

Use the `toJSONSchema` function to convert a Valibot schema into JSON schema (v7).

```js
import { toJSONSchema } from '@gcornut/valibot-json-schema/toJSONSchema';
import { string } from 'valibot';

toJSONSchema({ schema: string() })
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

To export your schemas in JSON schema definitions, you can provide the `definitions` option of the `toJSONSchema`
function in which each schema is attributed a name via it's key in the object.

```js
import { toJSONSchema } from '@gcornut/valibot-json-schema/toJSONSchema';
import { number } from 'valibot';

const Number = number();
toJSONSchema({ schema: Number, definitions: { Number } });
/**
 * Returns:
 * {
 *    $schema: 'http://json-schema.org/draft-07/schema#',
 *    $ref: '#/definitions/Number',
 *    definitions: { Number: { type: 'number' } },
 * }
 */
```

### Strict object types

While the converter can't handle the Valibot `strict` method that blocks unknown keys on object, you can however, set
the `strictObjectTypes` in the options to force ALL object types to block unknown keys (`additionalProperties: false`).

Example: `toJSONSchema({ schema: object({}), strictObjectTypes: true });`

### Supported features

All Valibot pipelines and methods are not supported because they do not offer introspection at runtime even if they have
equivalent JSON schema feature.

Here is the list of supported Valibot schemas (some have partial support):

<details>
<summary>Supported schemas</summary>

|                | status                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| `any`          | supported                                                                                     |
| `null`         | supported                                                                                     |
| `literal`      | partial: only JSON literal are supported                                                      |
| `number`       | supported                                                                                     |
| `string`       | supported                                                                                     |
| `boolean`      | supported                                                                                     |
| `nullable`     | supported                                                                                     |
| `optional`     | partial: only inside `object` schemas                                                         |
| `never`        | partial: only inside `object` rest or `tuple` rest params                                     |
| `enum`         | supported                                                                                     |
| `union`        | supported                                                                                     |
| `intersection` | supported                                                                                     |
| `array`        | supported                                                                                     |
| `tuple`        | supported                                                                                     |
| `object`       | supported                                                                                     |
| `record`       | partial: only string key are allowed, applicable to plain object only, not arrays             |
| `recursive`    | partial: only if the schema inside [is referenced in `definitions`](#json-schema-definitions) |

</details>
