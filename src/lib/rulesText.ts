// Card rules text embeds game symbols as tokens like `:rb_energy_2:` or `:rb_rune_fury:`.
// Split it into plain text and symbol parts so the UI can draw the symbols.

export type RulesPart = { kind: 'text'; text: string } | { kind: 'energy'; value: string } | { kind: 'rune'; domain: string } | { kind: 'icon'; name: string };

const TOKEN = /:rb_([a-z0-9_]+):/g;

export function parseRulesText(text: string): RulesPart[] {
  const parts: RulesPart[] = [];
  let last = 0;
  // Some sources run a closing parenthesis into the next word: "(x)y" -> "(x) y".
  const src = text.replace(/\)(?=[^\s.,;!?)\]])/g, ') ');
  for (const m of src.matchAll(TOKEN)) {
    if (m.index! > last) parts.push({ kind: 'text', text: src.slice(last, m.index) });
    const name = m[1];
    if (name.startsWith('energy_')) parts.push({ kind: 'energy', value: name.slice(7) });
    else if (name.startsWith('rune_')) parts.push({ kind: 'rune', domain: name.slice(5) });
    else parts.push({ kind: 'icon', name });
    last = m.index! + m[0].length;
  }
  if (last < src.length) parts.push({ kind: 'text', text: src.slice(last) });
  return parts;
}
