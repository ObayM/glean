import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightToHtml, splitByWord } from './highlight';

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#039;xss&#039;)&quot;&gt;'
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('ephemeral')).toBe('ephemeral');
  });
});

describe('splitByWord', () => {
  it('marks every case-insensitive occurrence of the word as a hit', () => {
    const parts = splitByWord('The Cat sat near the cat.', 'cat');
    expect(parts).toEqual([
      { text: 'The ', hit: false },
      { text: 'Cat', hit: true },
      { text: ' sat near the ', hit: false },
      { text: 'cat', hit: true },
      { text: '.', hit: false },
    ]);
  });

  it('treats regex metacharacters in the word as literal text', () => {
    const parts = splitByWord('cost is $5.00 today', '$5.00');
    expect(parts).toContainEqual({ text: '$5.00', hit: true });
  });

  it('returns the whole sentence unhit when the word is empty', () => {
    expect(splitByWord('hello world', '')).toEqual([{ text: 'hello world', hit: false }]);
  });
});

describe('highlightToHtml', () => {
  it('wraps only the matched word in <b> and escapes everything, including the word', () => {
    const html = highlightToHtml('<script>bad</script> loves cats', 'loves');
    expect(html).toBe('&lt;script&gt;bad&lt;/script&gt; <b>loves</b> cats');
  });

  it('escapes HTML inside the matched word itself', () => {
    const html = highlightToHtml('say <b>hi</b> now', '<b>hi</b>');
    expect(html).toBe('say <b>&lt;b&gt;hi&lt;/b&gt;</b> now');
  });
});
