import { escapeCsvCell } from './escape-csv-cell';

describe('escapeCsvCell', () => {
  it('neutralizes spreadsheet formulas', () => {
    expect(escapeCsvCell('=CMD()')).toBe("'=CMD()");
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('quotes commas and quotes', () => {
    expect(escapeCsvCell('Café "Central"')).toBe('"Café ""Central"""');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeCsvCell('Padaria Central')).toBe('Padaria Central');
  });
});
