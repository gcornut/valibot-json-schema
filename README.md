# @gcornut/valibot-json-schema

CLI and JS utility to convert valibot schemas to JSON schema (draft 07).

Some of the features of Valibot can't be converted to JSON schema. JS-specific types like `blob` or `nan` obviously
can't have an equivalent.  
[See supported features](#supported-features) for more info.

## Command Line Tool

This lib exports a CLI that can be used to quickly convert JS modules defining valibot schemas into a JSON schema.

```shell
# Convert valibot schemas to JSON schema
npx @gcornut/valibot-json-schema to-json-schema ./schemas.js
```

This outputs a conversion of the Valibot schemas into JSON schema. If the default export is a Valibot schemas, it is
used as
the root definition. Other exported Valibot schemas are converted in the JSON schema <code>definitions</code> section.

<details><summary><b>See detailed input and output:</b></summary>

_Input file `./schemas.js`_:

```js
import * as v from 'valibot';

export const AString = v.string();
const AnObject = v.object({ aString: AString });
export default AnObject;
```

_Output conversion_:

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
separately, so it is exported to the `definitions` section.

</details>

### ESM and TypeScript input module

The `valibot-json-schema` CLI loads the input JS module using **standard NodeJS CommonJS require**. This means you will
have issues with **ESM or TypeScript modules**.

To remedy that, you will either have to preinstall `ebuild-runner` and `esbuild` (so that the program can use them) or
use a Node-compatible runtime that support these modules (ex: bun, replacing `npx` with `bunx`).

Example:

```shell
# Convert from TS/ESM module using bunx
bunx @gcornut/valibot-json-schema to-json-schema ./schemas.ts

# Convert from TS/ESM module with esbuild-runner preinstalled
npm install esbuild esbuild-runner
npx @gcornut/valibot-json-schema to-json-schema ./schemas.ts

# Convert from TS/ESM module using `yarn dlx` multi-package feature 
yarn dlx -p esbuild -p esbuild-runner -p @gcornut/valibot-json-schema valibot-json-schema to-json-schema ./schemas.ts
```

### CLI parameters

Use `-o <file>` option to output the JSON schema to a file instead of `stdout`.

Use `-t <type>` option to select the root definitions from the module exports (instead of using the default export).
Example: `-t foo.bar` will get the property `bar` on the `foo` export of the input JS module.

Use `-d <type>` option to select the definitions from the module exports (instead of using all non-default export).
Example: `-d foo.bar` will get the property `bar` on the `foo` export of the input JS module.

Use `--strictObjectTypes` to generate strict object types that do not allow unknown
properties (`additionnalProperties: false`).

## Programmatic usage

Use the `toJSONSchema` function to convert a Valibot schema into JSON schema (v7).

```js
import { toJSONSchema } from '@gcornut/valibot-json-schema';
import { string } from 'valibot';

toJSONSchema({ schema: string() })
// {
//    $schema: 'http://json-schema.org/draft-07/schema#',
//    type: 'string',
// }
```

### JSON Schema definitions

To export your schemas in JSON schema definitions, you can provide the `definitions` option of the `toJSONSchema`
function in which each schema is attributed a name via it's key in the object.

```js
import { toJSONSchema } from '@gcornut/valibot-json-schema';
import { number } from 'valibot';

const Number = number();
toJSONSchema({ schema: Number, definitions: { Number } });
// {
//    $schema: 'http://json-schema.org/draft-07/schema#',
//    $ref: '#/definitions/Number',
//    definitions: { Number: { type: 'number' } },
// }
```

### Strict object types

While the converter can't handle the Valibot `strict` method that blocks unknown keys on object, you can however, set
the `strictObjectTypes` in the options to force ALL object types to block unknown keys (`additionalProperties: false`).

Example: `toJSONSchema({ schema: object({}), strictObjectTypes: true });`

## Supported features

Some Valibot schema, validation pipe and methods are supported because they do not they do not have equivalent JSON
schema feature.
Some converted schema might have slightly different behavior in a JSON schema validator, especially on string
formats (`email`, `ipv4`, `date`, etc.) since their implementation is different from valibot implementation.

Here is the list of supported Valibot features (some have partial support):

| feature                   | status                                                                                           |
|---------------------------|--------------------------------------------------------------------------------------------------|
| `any` schema              | ✅ supported                                                                                      |
| `null` schema             | ✅ supported                                                                                      |
| `number` schema           | ✅ supported                                                                                      |
| `string` schema           | ✅ supported                                                                                      |
| `boolean` schema          | ✅ supported                                                                                      |
| `literal` schema          | ⚠️ partial: only JSON-compatible literal are supported                                           |
| `nullable` schema         | ✅ supported                                                                                      |
| `nullish` schema          | ✅ supported                                                                                      |
| `optional` schema         | ✅ supported                                                                                      |
| `never` schema            | ⚠️ partial: only inside `object` rest or `tuple` rest params                                     |
| `picklist` schema         | ⚠️ partial: only JSON-compatible literal are supported                                           |
| `union` schema            | ✅ supported                                                                                      |
| `intersect` schema        | ✅ supported                                                                                      |
| `array` schema            | ✅ supported                                                                                      |
| `tuple` schema            | ✅ supported                                                                                      |
| `object` schema           | ✅ supported                                                                                      |
| `record` schema           | ⚠️ partial: only string key are allowed, applicable to plain object only, not arrays             |
| `recursive` schema        | ⚠️ partial: only if the schema inside [is referenced in `definitions`](#json-schema-definitions) |
| `date` schema             | ⚠️ with `dateStrategy` option provided                                                           |
| `length` validation       | ✅ supported                                                                                      |
| `maxLength` validation    | ✅ supported                                                                                      |
| `minLength` validation    | ✅ supported                                                                                      |
| `regex` validation        | ⚠️ partial: only on RegExp features supported by JSON schema                                     |
| `value` validation        | ⚠️ partial: only on `string`, `number` and `boolean`                                             |
| `minValue` validation     | ⚠️ partial: only on `number`                                                                     |
| `maxValue` validation     | ⚠️ partial: only on `number`                                                                     |
| `multipleOf` validation   | ✅ supported                                                                                      |
| `integer` validation      | ✅ supported                                                                                      |
| `email` validation        | ✅ supported (JSON schema format)                                                                 |
| `isoDate` validation      | ✅ supported (JSON schema format)                                                                 |
| `isoTimestamp` validation | ✅ supported (JSON schema format)                                                                 |
| `ipv4` validation         | ✅ supported (JSON schema format)                                                                 |
| `ipv6` validation         | ✅ supported (JSON schema format)                                                                 |
| `uuid` validation         | ✅ supported (JSON schema format)                                                                 |
