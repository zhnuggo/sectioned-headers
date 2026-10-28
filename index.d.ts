/**
 * A pattern used to locate delimiters in the text.
 *
 * - A `string` is matched literally (regex special characters are escaped).
 * - A `RegExp` is matched as-is at the current scan position. Its `g` and `y`
 *   flags are ignored, and zero-length matches are never treated as a match.
 */
export type Pattern = string | RegExp;

/**
 * Options controlling how headers are recognized.
 */
export interface ParseOptions {
  /**
   * Marks the start of a header (e.g. `'<'`).
   */
  open: Pattern;

  /**
   * Marks the end of a header (e.g. `'>'`). A `close` that is inside quotes
   * or immediately preceded by an `escape` is ignored.
   */
  close: Pattern;

  /**
   * Quote delimiter(s). Text between a pair of identical quotes inside a
   * header is protected from being read as `close`. Set to `null` to disable
   * quote handling entirely, so quote characters have no special meaning.
   * Omitting the option (or passing `undefined`) uses the default.
   *
   * @default /["']/
   */
  quotes?: Pattern | null;

  /**
   * Escape marker. The character that follows it is taken literally and
   * cannot act as `close` or as a quote. Set to `null` to disable escape
   * handling entirely, so escape characters have no special meaning (this
   * includes inside quotes). Omitting the option (or passing `undefined`)
   * uses the default.
   *
   * @default '\\'
   */
  escape?: Pattern | null;
}

/**
 * Parsed sections: each key is a header's text, each value is the text
 * that follows that header up to the next header (or the end of input).
 * Any text before the first header is stored under the key `null`. Entries
 * are ordered by the first appearance of each header, so the `null` entry,
 * when present, comes first. Because this is a `Map`, any string is a safe
 * key (including `__proto__`), and `null` can never collide with a header.
 */
export type Sections = Map<string | null, string>;

/**
 * Splits `text` into sections introduced by headers.
 *
 * If the same header appears more than once, the later section's text
 * replaces the earlier one, and the entry keeps the position of the
 * header's first appearance.
 *
 * Passing `quotes: null` disables quote handling, and `escape: null`
 * disables escape handling. The two are independent of each other.
 *
 * Text before the first header is stored under the key `null`, exactly as
 * written (including whitespace). If there is no such text, there is no
 * `null` entry. If the text contains no headers at all, the entire text is
 * stored under `null`.
 *
 * @param text    The text to parse.
 * @param options Header delimiters and quoting/escaping rules.
 * @returns A `Map` of each header's text to its section text, plus a `null`
 *          entry for any text before the first header. The map is empty
 *          only when `text` is empty.
 */
export function parse(text: string, options: ParseOptions): Sections;