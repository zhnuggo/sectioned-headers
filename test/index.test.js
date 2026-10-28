import { expect } from 'chai';
import { parse } from '../index.js';

const angle = { open: '<', close: '>' };

// Builds the expected Map from a plain object (for readable assertions).
// If `preamble` is given, it is added first under the `null` key.
const sections = (obj, preamble) => {
    const entries = Object.entries(obj);

    if (preamble !== undefined) {
        entries.unshift([null, preamble]);
    }

    return new Map(entries);
};

describe('parse()', () => {
    describe('basic behavior', () => {
        it('parses the example from the spec', () => {
            const text =
        '<font settings>\n' +
        'family: Helvetica\n' +
        'size: 12pt\n' +
        'color: black\n' +
        '\n' +
        '<content>\n' +
        'This is some text.';

            expect(parse(text, angle)).to.deep.equal(
                sections({
                    'font settings': 'family: Helvetica\nsize: 12pt\ncolor: black\n\n',
                    content: 'This is some text.'
                })
            );
        });

        it('returns a Map', () => {
            const result = parse('<a>\nx', angle);
            expect(result).to.be.instanceOf(Map);
            expect(result.get('a')).to.equal('x');
            expect(result.has('missing')).to.equal(false);
        });

        it('returns an empty Map for empty text', () => {
            const result = parse('', angle);
            expect(result).to.be.instanceOf(Map);
            expect(result.size).to.equal(0);
        });

        it('stores all text under null when there are no headers', () => {
            expect(parse('just some plain text\nwith lines', angle)).to.deep.equal(
                sections({}, 'just some plain text\nwith lines')
            );
        });

        it('returns an empty string for a header with no body', () => {
            expect(parse('<a>\n<b>\nx', angle)).to.deep.equal(
                sections({ a: '', b: 'x' })
            );
        });

        it('handles a header at the very end of the text', () => {
            expect(parse('<a>', angle)).to.deep.equal(sections({ a: '' }));
        });

        it('preserves whitespace inside header keys', () => {
            expect(parse('< a >\nbody', angle)).to.deep.equal(
                sections({ ' a ': 'body' })
            );
        });

        it('allows headers to span multiple lines', () => {
            expect(parse('<multi\nline>\nbody', angle)).to.deep.equal(
                sections({ 'multi\nline': 'body' })
            );
        });
    });

    describe('text before the first header', () => {
        it('stores it under the null key', () => {
            const result = parse('preamble\nmore preamble\n<a>\nbody', angle);
            expect(result.get(null)).to.equal('preamble\nmore preamble\n');
            expect(result.get('a')).to.equal('body');
            expect(result.size).to.equal(2);
        });

        it('matches the expected Map exactly', () => {
            expect(parse('intro\n<a>\nbody', angle)).to.deep.equal(
                sections({ a: 'body' }, 'intro\n')
            );
        });

        it('does not apply the post-header line break rule to it', () => {
            expect(parse('\n\nintro\n<a>\nx', angle).get(null)).to.equal('\n\nintro\n');
        });

        it('preserves whitespace-only text', () => {
            expect(parse('  \n<a>\nx', angle).get(null)).to.equal('  \n');
        });

        it('has no null entry when the text starts with a header', () => {
            const result = parse('<a>\nbody', angle);
            expect(result.has(null)).to.equal(false);
            expect(result.size).to.equal(1);
        });

        it('has no null entry for empty text', () => {
            const result = parse('', angle);
            expect(result.has(null)).to.equal(false);
            expect(result.size).to.equal(0);
        });

        it('places the null entry first', () => {
            const result = parse('intro<b>\n1\n<a>\n2', angle);
            expect([...result.keys()]).to.deep.equal([null, 'b', 'a']);
        });

        it('does not collide with an empty header name', () => {
            const result = parse('intro<>\nbody', angle);
            expect(result.get(null)).to.equal('intro');
            expect(result.get('')).to.equal('body');
            expect(result.size).to.equal(2);
        });

        it('does not collide with a header named "null"', () => {
            const result = parse('intro<null>\nbody', angle);
            expect(result.get(null)).to.equal('intro');
            expect(result.get('null')).to.equal('body');
        });

        it('does not apply to text after a header', () => {
            const result = parse('<a>\n1\n<b>\n2', angle);
            expect(result.has(null)).to.equal(false);
        });

        it('stores text with an unclosed open under null when there are no headers', () => {
            expect(parse('<a\nbody', angle)).to.deep.equal(
                sections({}, '<a\nbody')
            );
        });

        it('works with regex delimiters', () => {
            const text = 'intro\n# Heading\nbody';
            expect(parse(text, { open: /#+\s*/, close: /\n/ })).to.deep.equal(
                sections({ Heading: 'body' }, 'intro\n')
            );
        });
    });

    describe('ordering and duplicates', () => {
        it('orders entries by first appearance', () => {
            const result = parse('<c>\n1\n<a>\n2\n<b>\n3', angle);
            expect([...result.keys()]).to.deep.equal(['c', 'a', 'b']);
        });

        it('lets a later duplicate header replace the earlier text', () => {
            const result = parse('<a>\n1\n<b>\n2\n<a>\n3', angle);
            expect(result.get('a')).to.equal('3');
            expect(result.get('b')).to.equal('2\n');
            expect(result.size).to.equal(2);
        });

        it('keeps a duplicate header at its first position', () => {
            const result = parse('<a>\n1\n<b>\n2\n<a>\n3', angle);
            expect([...result.keys()]).to.deep.equal(['a', 'b']);
        });
    });

    describe('special key names', () => {
        it('supports a "__proto__" header', () => {
            const result = parse('<__proto__>\nvalue', angle);
            expect(result.size).to.equal(1);
            expect(result.get('__proto__')).to.equal('value');
        });

        it('supports headers named like Object.prototype members', () => {
            const result = parse(
                '<constructor>\na\n<toString>\nb\n<hasOwnProperty>\nc',
                angle
            );
            expect(result.get('constructor')).to.equal('a\n');
            expect(result.get('toString')).to.equal('b\n');
            expect(result.get('hasOwnProperty')).to.equal('c');
        });

        it('supports an empty header name', () => {
            expect(parse('<>\nbody', angle).get('')).to.equal('body');
        });
    });

    describe('line break after a header', () => {
        it('drops a single "\\n" directly after the header', () => {
            expect(parse('<a>\nbody', angle).get('a')).to.equal('body');
        });

        it('drops a single "\\r\\n" directly after the header', () => {
            expect(parse('<a>\r\nbody', angle).get('a')).to.equal('body');
        });

        it('drops only one line break', () => {
            expect(parse('<a>\n\nbody', angle).get('a')).to.equal('\nbody');
        });

        it('keeps the body intact when no line break follows the header', () => {
            expect(parse('<a>body', angle).get('a')).to.equal('body');
        });

        it('keeps trailing whitespace in section bodies', () => {
            expect(parse('<a>\nx  \n\n<b>\ny', angle)).to.deep.equal(
                sections({ a: 'x  \n\n', b: 'y' })
            );
        });
    });

    describe('section bodies', () => {
        it('does not treat close characters in a body as special', () => {
            expect(parse('<a>\n1 > 0', angle).get('a')).to.equal('1 > 0');
        });

        it('does not apply quote or escape handling to body text', () => {
            expect(parse('<a>\nhe said "hi" \\> there', angle).get('a')).to.equal(
                'he said "hi" \\> there'
            );
        });

        it('treats an open with no matching close as plain text', () => {
            expect(parse('<a>\n1 < 2 and more', angle).get('a')).to.equal(
                '1 < 2 and more'
            );
        });

        it('stores everything under null when the only open has no close', () => {
            const result = parse('<a\nbody', angle);
            expect(result.size).to.equal(1);
            expect(result.get(null)).to.equal('<a\nbody');
        });
    });

    describe('quotes', () => {
        it('ignores close inside double quotes', () => {
            expect(parse('<a ">" b>text', angle)).to.deep.equal(
                sections({ 'a ">" b': 'text' })
            );
        });

        it('ignores close inside single quotes', () => {
            expect(parse('<a \'>\' b>text', angle)).to.deep.equal(
                sections({ 'a \'>\' b': 'text' })
            );
        });

        it('requires the closing quote to match the opening quote', () => {
            expect(parse('<a "it\'s>" b>text', angle)).to.deep.equal(
                sections({ 'a "it\'s>" b': 'text' })
            );
        });

        it('honors escapes inside quotes', () => {
            expect(parse('<a "x\\"y>z" b>text', angle)).to.deep.equal(
                sections({ 'a "x\\"y>z" b': 'text' })
            );
        });

        it('treats an unterminated quote as a literal character', () => {
            expect(parse('<don\'t>text', angle)).to.deep.equal(
                sections({ 'don\'t': 'text' })
            );
        });

        it('supports custom string quotes', () => {
            expect(parse('<a `>` b>text', { ...angle, quotes: '`' })).to.deep.equal(
                sections({ 'a `>` b': 'text' })
            );
        });

        it('no longer treats default quotes as special when custom quotes are set', () => {
            expect(parse('<a ">" b>text', { ...angle, quotes: '`' })).to.deep.equal(
                sections({ 'a "': '" b>text' })
            );
        });

        it('supports regex quotes', () => {
            const opts = { ...angle, quotes: /["'`]/ };
            expect(parse('<a `>` b>one', opts)).to.deep.equal(
                sections({ 'a `>` b': 'one' })
            );
            expect(parse('<a ">" b>two', opts)).to.deep.equal(
                sections({ 'a ">" b': 'two' })
            );
        });

        it('uses the default quotes when quotes is undefined', () => {
            expect(parse('<a ">" b>text', { ...angle, quotes: undefined })).to.deep.equal(
                sections({ 'a ">" b': 'text' })
            );
        });
    });

    describe('quotes: null', () => {
        const noQuotes = { ...angle, quotes: null };

        it('does not protect close inside double quotes', () => {
            expect(parse('<a ">" b>text', noQuotes)).to.deep.equal(
                sections({ 'a "': '" b>text' })
            );
        });

        it('does not protect close inside single quotes', () => {
            expect(parse('<a \'>\' b>text', noQuotes)).to.deep.equal(
                sections({ 'a \'': '\' b>text' })
            );
        });

        it('treats quote characters as ordinary header text', () => {
            expect(parse('<don\'t>text', noQuotes)).to.deep.equal(
                sections({ 'don\'t': 'text' })
            );
            expect(parse('<say "hi">text', noQuotes)).to.deep.equal(
                sections({ 'say "hi"': 'text' })
            );
        });

        it('does not let an unterminated quote swallow later headers', () => {
            // With quote handling on, the unmatched quote is literal as well, so
            // this checks that disabling quotes never changes the outcome here.
            expect(parse('<it\'s>\n1\n<b>\n2', noQuotes)).to.deep.equal(
                sections({ 'it\'s': '1\n', b: '2' })
            );
        });

        it('still honors escapes', () => {
            expect(parse('<a \\> b>text', noQuotes)).to.deep.equal(
                sections({ 'a \\> b': 'text' })
            );
        });

        it('still honors a custom escape', () => {
            expect(parse('<a ^> b>text', { ...noQuotes, escape: '^' })).to.deep.equal(
                sections({ 'a ^> b': 'text' })
            );
        });

        it('does not throw or match the text "null"', () => {
            expect(parse('<a>\nnull value null', noQuotes)).to.deep.equal(
                sections({ a: 'null value null' })
            );
            expect(parse('<anullb>\nx', noQuotes)).to.deep.equal(
                sections({ anullb: 'x' })
            );
        });
    });

    describe('escapes', () => {
        it('ignores an escaped close', () => {
            expect(parse('<a \\> b>text', angle)).to.deep.equal(
                sections({ 'a \\> b': 'text' })
            );
        });

        it('does not let an escaped quote open a quoted section', () => {
            // If \" opened a quote, the first ">" would be swallowed.
            expect(parse('<a \\"b> c">text', angle)).to.deep.equal(
                sections({ 'a \\"b': ' c">text' })
            );
        });

        it('supports a custom string escape', () => {
            expect(parse('<a ^> b>text', { ...angle, escape: '^' })).to.deep.equal(
                sections({ 'a ^> b': 'text' })
            );
        });

        it('no longer treats backslash as special when a custom escape is set', () => {
            expect(parse('<a \\> b>text', { ...angle, escape: '^' })).to.deep.equal(
                sections({ 'a \\': ' b>text' })
            );
        });

        it('supports a regex escape', () => {
            const opts = { ...angle, escape: /[\\^]/ };
            expect(parse('<a ^> b>one', opts)).to.deep.equal(
                sections({ 'a ^> b': 'one' })
            );
            expect(parse('<a \\> b>two', opts)).to.deep.equal(
                sections({ 'a \\> b': 'two' })
            );
        });

        it('uses the default escape when escape is undefined', () => {
            expect(parse('<a \\> b>text', { ...angle, escape: undefined })).to.deep.equal(
                sections({ 'a \\> b': 'text' })
            );
        });
    });

    describe('escape: null', () => {
        const noEscape = { ...angle, escape: null };

        it('does not protect an otherwise escaped close', () => {
            expect(parse('<a \\> b>text', noEscape)).to.deep.equal(
                sections({ 'a \\': ' b>text' })
            );
        });

        it('lets a backslash-preceded quote open a quoted section', () => {
            // The backslash is ordinary, so the quote opens and protects ">".
            expect(parse('<a \\"x>y" b>text', noEscape)).to.deep.equal(
                sections({ 'a \\"x>y" b': 'text' })
            );
        });

        it('does not escape the closing quote inside a quoted section', () => {
            // The backslash does not escape the quote, so it ends the quoted
            // section and the following ">" closes the header.
            expect(parse('<a "x\\">y" b>text', noEscape)).to.deep.equal(
                sections({ 'a "x\\"': 'y" b>text' })
            );
        });

        it('still honors quotes', () => {
            expect(parse('<a ">" b>text', noEscape)).to.deep.equal(
                sections({ 'a ">" b': 'text' })
            );
        });

        it('still honors custom quotes', () => {
            expect(parse('<a `>` b>text', { ...noEscape, quotes: '`' })).to.deep.equal(
                sections({ 'a `>` b': 'text' })
            );
        });

        it('does not throw or match the text "null"', () => {
            expect(parse('<a>\nnull value null', noEscape)).to.deep.equal(
                sections({ a: 'null value null' })
            );
            expect(parse('<anullb>\nx', noEscape)).to.deep.equal(
                sections({ anullb: 'x' })
            );
        });
    });

    describe('quotes: null and escape: null together', () => {
        const plain = { ...angle, quotes: null, escape: null };

        it('ends the header at the first close', () => {
            expect(parse('<a ">" b>text', plain)).to.deep.equal(
                sections({ 'a "': '" b>text' })
            );
            expect(parse('<a \\> b>text', plain)).to.deep.equal(
                sections({ 'a \\': ' b>text' })
            );
        });

        it('parses the spec example unchanged', () => {
            const text = '<font settings>\nsize: 12pt\n\n<content>\nHello';
            expect(parse(text, plain)).to.deep.equal(
                sections({ 'font settings': 'size: 12pt\n\n', content: 'Hello' })
            );
        });

        it('still discards unclosed opens as plain text', () => {
            expect(parse('<a>\n1 < 2', plain).get('a')).to.equal('1 < 2');
            expect(parse('<a\nbody', plain)).to.deep.equal(sections({}, '<a\nbody'));
        });

        it('works with regex open and close', () => {
            const text = '# Intro\nit\'s "fine"\n## Details\nworld';
            expect(parse(text, { open: /#+\s*/, close: /\n/, quotes: null, escape: null }))
                .to.deep.equal(
                    sections({ Intro: 'it\'s "fine"\n', Details: 'world' })
                );
        });
    });

    describe('string and regex delimiters', () => {
        it('supports multi-character string delimiters', () => {
            const text = '[[title]]\nbody\n[[other]]\nmore';
            expect(parse(text, { open: '[[', close: ']]' })).to.deep.equal(
                sections({ title: 'body\n', other: 'more' })
            );
        });

        it('matches string delimiters literally, not as regex', () => {
            expect(
                parse('(.*)a(.*)\nbody', { open: '(.*)', close: '(.*)' })
            ).to.deep.equal(sections({ a: 'body' }));
        });

        it('supports regex open and close', () => {
            const text = '# Intro\nhello\n## Details\nworld';
            expect(parse(text, { open: /#+\s*/, close: /\n/ })).to.deep.equal(
                sections({ Intro: 'hello\n', Details: 'world' })
            );
        });

        it('ignores the g and y flags on regex delimiters', () => {
            const opts = { open: /</g, close: />/y };
            const text = '<a>\n1\n<b>\n2';
            const expected = sections({ a: '1\n', b: '2' });
            expect(parse(text, opts)).to.deep.equal(expected);
            // Reusing the same regex objects must give the same result.
            expect(parse(text, opts)).to.deep.equal(expected);
        });

        it('supports character-class regex delimiters', () => {
            expect(
                parse('<a>\n1\n[B]\n2', { open: /[<\[]/, close: /[>\]]/ })
            ).to.deep.equal(sections({ a: '1\n', B: '2' }));
        });
    });

    describe('unicode', () => {
        it('handles astral characters in headers and bodies', () => {
            expect(parse('<😀 title>\nbody 😀\n<x>\ny', angle)).to.deep.equal(
                sections({ '😀 title': 'body 😀\n', x: 'y' })
            );
        });

        it('treats an escaped astral character as a single unit', () => {
            expect(parse('<a \\😀>text', angle)).to.deep.equal(
                sections({ 'a \\😀': 'text' })
            );
        });
    });
});