import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { formatDecimal } from './numbers';

// The build adds the data of the locale it is made in; a test in another one adds its own.
registerLocaleData(localePt);

describe('formatDecimal', () => {
  it('sets a number the way the language does', () => {
    expect(formatDecimal(5.14, 'en-GB', '1.1-1')).toBe('5.1');
    expect(formatDecimal(5.14, 'pt-BR', '1.1-1')).toBe('5,1');
    expect(formatDecimal(1994, 'en-GB')).toBe('1,994');
    expect(formatDecimal(1994, 'pt-BR')).toBe('1.994');
  });

  it('writes a value below zero with a true minus, a digit wide', () => {
    expect(formatDecimal(-0.4, 'en-GB', '1.1-1')).toBe('−0.4');
    expect(formatDecimal(-0.4, 'pt-BR', '1.1-1')).toBe('−0,4');
  });
});
