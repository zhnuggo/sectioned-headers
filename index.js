/**
 * A pattern used to locate delimiters in the text.
 *
 * - A `string` is matched literally (regex special characters are escaped).
 * - A `RegExp` is matched as-is at the current scan position. Its `g` and `y`
 *   flags are ignored, and zero-length matches are never treated as a match.
 *
 * @typedef {string | RegExp} Pattern
 */

/**
 * Options controlling how headers are recognized.
 *
 * @typedef {Object} ParseOptions
 * @property {Pattern} open
 *   Marks the start of a header (e.g. `'<'`).
 * @property {Pattern} close
 *   Marks the end of a header (e.g. `'>'`). A `close` that is inside quotes
 *   or immediately preceded by an `escape` is ignored.
 * @property {Pattern | null} [quotes=/["']/]
 *   Quote delimiter(s). Text between a pair of identical quotes inside a
 *   header is protected from being read as `close`. Set to `null` to disable
 *   quote handling entirely, so quote characters have no special meaning.
 *   Omitting the option (or passing `undefined`) uses the default.
 * @property {Pattern | null} [escape='\\']
 *   Escape marker. The character that follows it is taken literally and
 *   cannot act as `close` or as a quote. Set to `null` to disable escape
 *   handling entirely, so escape characters have no special meaning (this
 *   includes inside quotes). Omitting the option (or passing `undefined`)
 *   uses the default.
 */

/**
 * Parsed sections: each key is a header's text, each value is the text
 * that follows that header up to the next header (or the end of input).
 * Any text before the first header is stored under the key `null`. Entries
 * are ordered by the first appearance of each header, so the `null` entry,
 * when present, comes first. Because this is a `Map`, any string is a safe
 * key (including `__proto__`), and `null` can never collide with a header.
 *
 * @typedef {Map<string | null, string>} Sections
 */

/**
 * Splits `text` into sections introduced by headers.
 *
 * A header begins at a match of `open` and extends to the next match of
 * `close` that is neither quoted nor escaped. The header's text (without the
 * delimiters) becomes the key. The section text is everything after the
 * header until the next header or the end of input.
 *
 * Details:
 * - Text before the first header is stored under the key `null`, exactly as
 *   written (including whitespace). If there is no such text, there is no
 *   `null` entry. If the text contains no headers at all, the entire text is
 *   stored under `null`.
 * - A single line break (`\n` or `\r\n`) directly after a header is dropped;
 *   all other whitespace is preserved.
 * - If the same header appears more than once, the later section's text
 *   replaces the earlier one, and the entry keeps the position of the
 *   header's first appearance.
 * - An `open` with no matching `close` is treated as plain text.
 * - An unterminated quote inside a header is treated as a literal character.
 * - Quotes must be closed by the same quote that opened them, and escapes
 *   are honored inside quotes.
 * - Passing `quotes: null` disables quote handling, and `escape: null`
 *   disables escape handling. The two are independent: with `escape: null`,
 *   quotes still protect `close` but a quote can no longer be escaped; with
 *   `quotes: null`, escapes still protect `close` but nothing is quoted.
 *
 * @param {string} text
 *   The text to parse.
 * @param {ParseOptions} options
 *   Header delimiters and quoting/escaping rules.
 * @returns {Sections}
 *   A `Map` of each header's text to its section text, plus a `null` entry
 *   for any text before the first header. The map is empty only when
 *   `text` is empty.
 *
 * @example
 * const sections = parse('<font settings>\nsize: 12pt\n\n<content>\nHello', {
 *   open: '<',
 *   close: '>',
 * });
 * sections.get('font settings'); // => "size: 12pt\n\n"
 * sections.get('content');       // => "Hello"
 *
 * @example
 * // Text before the first header is stored under the `null` key
 * parse('Intro text\n<a>\nbody', { open: '<', close: '>' });
 * // => Map { null => 'Intro text\n', 'a' => 'body' }
 *
 * @example
 * // `close` inside quotes or after an escape does not end the header
 * parse('<a ">" b>text', { open: '<', close: '>' }).get('a ">" b');
 * // => "text"
 *
 * @example
 * // Disable quote handling: the quoted `>` now ends the header
 * parse('<a ">" b>text', { open: '<', close: '>', quotes: null });
 * // => Map { 'a "' => '" b>text' }
 */
export function parse(text, { open, close, quotes = /["']/, escape = '\\' }) {
    const toSticky = (p) =>
        p instanceof RegExp
            ? new RegExp(p.source, p.flags.replace(/[gy]/g, '') + 'y')
            : new RegExp(String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'y');

    const openRe = toSticky(open);
    const closeRe = toSticky(close);
    // A `null` option disables that feature: no matcher, so it never matches.
    const quoteRe = quotes === null ? null : toSticky(quotes);
    const escapeRe = escape === null ? null : toSticky(escape);

    // Returns the matched text at index i (only non-empty matches), else null
    const matchAt = (re, i) => {
        if (re === null) {
            return null;
        }

        re.lastIndex = i;
        const m = re.exec(text);
        return m && m[0].length ? m[0] : null;
    };

    // Length of the code point at index i (so we skip whole characters)
    const charLen = (i) => {
        const cp = text.codePointAt(i);
        return cp !== undefined && cp > 0xffff ? 2 : 1;
    };

    // Find the end of a quoted string whose opening quote ends at `from`.
    // Returns the index just past the closing quote, or -1 if unterminated.
    const skipQuoted = (from, q) => {
        let k = from;

        while (k < text.length) {
            const esc = matchAt(escapeRe, k);

            if (esc) {
                k += esc.length;

                if (k < text.length) {
                    k += charLen(k);
                }
            }
            else if (text.startsWith(q, k)) {
                return k + q.length;
            }
            else {
                k += charLen(k);
            }
        }

        return -1;
    };

    // Parse a header body starting at `from`.
    // Returns { key, end } (end = index just past the close), or null if unclosed.
    const readHeader = (from) => {
        let j = from;

        while (j < text.length) {
            const esc = matchAt(escapeRe, j);

            if (esc) {
                j += esc.length;

                if (j < text.length) {
                    j += charLen(j);
                }

                continue;
            }

            const q = matchAt(quoteRe, j);

            if (q) {
                const end = skipQuoted(j + q.length, q);

                if (end !== -1) {
                    j = end;
                    continue;
                }
                // Unterminated quote: treat it as a literal character
            }

            const c = matchAt(closeRe, j);

            if (c) {
                return { key: text.slice(from, j), end: j + c.length };
            }

            j += charLen(j);
        }

        return null;
    };

    const result = new Map();
    let key = null;       // current section's header (null = before first header)
    let bodyStart = 0;    // where the current section's text begins
    let i = 0;

    const flush = (end) => {
        const body = text.slice(bodyStart, end);

        // Header sections are always stored (even when empty). The text before
        // the first header (key === null) is stored only when it is non-empty.
        if (key !== null || body.length > 0) {
            result.set(key, body);
        }
    };

    while (i < text.length) {
        const o = matchAt(openRe, i);

        if (o) {
            const header = readHeader(i + o.length);

            if (header) {
                flush(i);
                key = header.key;
                i = header.end;
                // Drop a single line break directly after the header
                const nl = /^\r?\n/.exec(text.slice(i, i + 2));

                if (nl) {
                    i += nl[0].length;
                }

                bodyStart = i;
                continue;
            }
        }

        i += charLen(i);
    }

    flush(text.length);
    return result;
}