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
   * header is protected from being read as `close`.
   *
   * @default /["']/
   */
  quotes?: Pattern;

  /**
   * Escape marker. The character that follows it is taken literally and
   * cannot act as `close` or as a quote.
   *
   * @default '\\'
   */
  escape?: Pattern;
}

/**
 * Parsed sections: each key is a header's text, each value is the text
 * that follows that header up to the next header (or the end of input).
 * Entries are ordered by the first appearance of each header. Because this
 * is a `Map`, any string is a safe key (including `__proto__`).
 */
export type Sections = Map<string, string>;

/**
 * Splits `text` into sections introduced by headers.
 *
 * If the same header appears more than once, the later section's text
 * replaces the earlier one, and the entry keeps the position of the
 * header's first appearance.
 *
 * @param text    The text to parse.
 * @param options Header delimiters and quoting/escaping rules.
 * @returns A `Map` of each header's text to its section text. The map is
 *          empty when no headers are found.
 */
export function parse(text: string, options: ParseOptions): Sections;