# Sectioned Headers
![Tests](https://img.shields.io/badge/tests-Mocha_+_Chai-saddlebrown?logo=mocha&logoColor=white&style=for-the-badge)
![Passed](https://img.shields.io/badge/passed-74_/_74-brightgreen?logo=testcafe&logoColor=white&style=for-the-badge)
<br>
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=for-the-badge)
[![NPM version](https://img.shields.io/npm/v/@zhnuggo/sectioned-headers.svg?style=for-the-badge)](https://www.npmjs.com/package/@zhnuggo/sectioned-headers)

Separates text into sections using a customizable header format.

You tell it what starts a header (`open`) and what ends it (`close`). Everything after a header, up to the next header, becomes that header's section. The result is a `Map` of header text to section text.

## Installation

```bash
npm i @zhnuggo/sectioned-headers
```

## Usage

```js
import { parse } from '@zhnuggo/sectioned-headers';

const text = `
[intro]
Hello there.

[details]
More text here.
`.trim();

const sections = parse(text, { open: '[', close: ']' });

for (const [header, body] of sections) {
  console.log(header, '=>', JSON.stringify(body));
}
// intro => "Hello there.\n\n"
// details => "More text here."
```

## API

### `parse(text, options)`

| Parameter | Type           | Description                                      |
| --------- | -------------- | ------------------------------------------------ |
| `text`    | `string`       | The text to split into sections.                 |
| `options` | `ParseOptions` | Header delimiters and quoting/escaping rules.    |

Returns a `Map<string, string>` where each key is a header's text (without the delimiters) and each value is the section text that follows it. The map is empty when the text contains no headers.

### ParseOptions

| Option   | Type               | Default   | Description                                                                                          |
| -------- | ------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `open`   | `string \| RegExp` | required  | Marks the start of a header.                                                                         |
| `close`  | `string \| RegExp` | required  | Marks the end of a header. Ignored when quoted or escaped.                                           |
| `quotes` | `string \| RegExp \| null ` | `/["']/`  | Quote delimiter(s). A `close` between a pair of identical quotes inside a header is ignored.         |
| `escape` | `string \| RegExp \| null` | `'\\'`    | Escape marker. The character after it is taken literally and cannot act as `close` or as a quote.    |

Every option accepts either a string or a regular expression:

- A **string** is matched literally. Regex special characters need no escaping, so `'(.*)'` matches exactly those five characters.
- A **RegExp** is matched as-is at the current position. The `g` and `y` flags are ignored, and zero-length matches never count as a match.

The `quotes` and `escape` options also accept a `null` value, which disables
checking for them when parsing.

## Notable Behavior

- Headers may span multiple lines.
- Text before the first header is stored under a `null` header, which is the
first element in the Map.<br>Text without any headers just results in
`Map { null => <text> }`.
- A line break directly after a header is dropped.<br>All other whitespace is preserved, so trailing blank lines stay in the section.
- For duplicate headers: the later section's text replaces the earlier one, and the entry keeps the position of the header's first appearance.
- The `parse` function returns `Map`, not an `Object`.
- An `open` with no matching `close` is treated as plain text.
- An unterminated quote inside a header is treated as a literal character<br>(so `<don't>` yields the header `don't`).
- Quote and escape rules apply only inside headers.<br>Body text is never interpreted.

## Examples

### Quoted and escaped delimiters

A `close` inside quotes, or right after an escape, does not end the header.

```js
parse('<a ">" b>text', { open: '<', close: '>' }).get('a ">" b');
// "text"

parse('<a \\> b>text', { open: '<', close: '>' }).get('a \\> b');
// "text"
```

The header text is returned exactly as written, including the quotes and escape characters.

### Custom quotes and escape

```js
parse('<a `>` b>text', { open: '<', close: '>', quotes: '`' });
// Map { 'a `>` b' => 'text' }

parse('<a ^> b>text', { open: '<', close: '>', escape: '^' });
// Map { 'a ^> b' => 'text' }
```

When you set `quotes` or `escape`, the defaults no longer apply.  
To disable one entirely, set it to `null`:

```js
parse('[Stuff\\]\ntext', { open: '[', close: ']', escape: null })
// Map { 'Stuff\\' => 'text'}
```

### Multi-character delimiters

```js
parse('[[title]]\nbody\n[[other]]\nmore', { open: '[[', close: ']]' });
// Map { 'title' => 'body\n', 'other' => 'more' }
```

### Regular expression delimiters

Markdown-style headings, where the header runs to the end of the line:

```js
const text = '# Intro\nhello\n## Details\nworld';

parse(text, { open: /#+\s*/, close: /\n/ });
// Map { 'Intro' => 'hello\n', 'Details' => 'world' }
```

Multiple delimiter styles at once:

```js
parse('<a>\n1\n[B]\n2', { open: /[<[]/, close: /[>\]]/ });
// Map { 'a' => '1\n', 'B' => '2' }
```

## TypeScript

Type declarations are included.

```ts
import { parse, type ParseOptions, type Sections } from '@zhnuggo/sectioned-headers';

const options: ParseOptions = { open: '<', close: '>' };
const sections: Sections = parse(text, options); // Map<string|null, string>
```

| Type           | Definition                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `Pattern`      | `string \| RegExp`                                                         |
| `ParseOptions` | `{ open: Pattern; close: Pattern; quotes?: Pattern \| null; escape?: Pattern \| null }`    |
| `Sections`     | `Map<string \| null, string>`                                                      |
