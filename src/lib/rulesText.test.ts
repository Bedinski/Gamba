import { parseRulesText } from './rulesText';

describe('parseRulesText', () => {
  it('splits energy, rune and icon tokens out of the text', () => {
    expect(parseRulesText('Pay :rb_energy_2: and :rb_rune_fury: to give +1 :rb_might:.')).toEqual([
      { kind: 'text', text: 'Pay ' },
      { kind: 'energy', value: '2' },
      { kind: 'text', text: ' and ' },
      { kind: 'rune', domain: 'fury' },
      { kind: 'text', text: ' to give +1 ' },
      { kind: 'icon', name: 'might' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('returns plain text untouched and fixes run-on parentheses', () => {
    expect(parseRulesText('Draw 1.')).toEqual([{ kind: 'text', text: 'Draw 1.' }]);
    expect(parseRulesText('(Shield)Deflect')).toEqual([{ kind: 'text', text: '(Shield) Deflect' }]);
  });

  it('handles a token at the very start and end', () => {
    expect(parseRulesText(':rb_exhaust:')).toEqual([{ kind: 'icon', name: 'exhaust' }]);
  });
});
