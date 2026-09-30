import { csvCell, csvLine, parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted fields with commas, doubled quotes and line breaks inside them', () => {
    const text =
      'id,place,mag\n' +
      'us1,"8 km S of Guánica, Puerto Rico",2.8\n' +
      'us2,"the ""Ring of Fire""",5.1\n' +
      'us3,"two\nlines",\n';

    expect(parseCsv(text)).toEqual([
      ['id', 'place', 'mag'],
      ['us1', '8 km S of Guánica, Puerto Rico', '2.8'],
      ['us2', 'the "Ring of Fire"', '5.1'],
      ['us3', 'two\nlines', ''],
    ]);
  });

  it('accepts CRLF line endings and a last line without one', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('reads nothing from an empty answer', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('csvCell', () => {
  it('quotes only what needs quoting', () => {
    expect(csvCell('South of the Fiji Islands')).toBe('South of the Fiji Islands');
    expect(csvCell('8 km S of Guánica, Puerto Rico')).toBe('"8 km S of Guánica, Puerto Rico"');
    expect(csvCell('the "Ring"')).toBe('"the ""Ring"""');
  });

  it('writes an unknown value as an empty cell, never as zero', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });

  it('defuses text a spreadsheet would run as a formula, and leaves negative numbers alone', () => {
    expect(csvCell('=HYPERLINK("http://evil.test")')).toBe('"\'=HYPERLINK(""http://evil.test"")"');
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-1.2)).toBe('-1.2');
  });
});

describe('csvLine', () => {
  it('ends every record with CRLF', () => {
    expect(csvLine(['us1', 2.8, null])).toBe('us1,2.8,\r\n');
  });
});
