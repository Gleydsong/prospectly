import { BadRequestException } from '@nestjs/common';

import { CsvParserService } from './csv-parser.service';

describe('CsvParserService', () => {
  const parser = new CsvParserService();

  it('parses comma-delimited files and suggests deterministic lead mappings', () => {
    const preview = parser.preview('Empresa,Telefone,E-mail,CEP\nAcme Ltda,11999999999,CONTATO@ACME.TEST,01001-000');

    expect(preview).toEqual({
      headers: ['Empresa', 'Telefone', 'E-mail', 'CEP'],
      rows: [{ Empresa: 'Acme Ltda', Telefone: '11999999999', 'E-mail': 'CONTATO@ACME.TEST', CEP: '01001-000' }],
      suggestedMapping: {
        companyName: 'Empresa',
        phone: 'Telefone',
        email: 'E-mail',
        postalCode: 'CEP',
      },
    });
  });

  it('detects semicolon-delimited files', () => {
    const parsed = parser.parse('Nome da empresa;Cidade;UF\nPadaria Central;Sao Paulo;SP');

    expect(parsed.delimiter).toBe(';');
    expect(parsed.rows).toEqual([{ 'Nome da empresa': 'Padaria Central', Cidade: 'Sao Paulo', UF: 'SP' }]);
  });

  it('preserves delimiters inside quoted values and unescapes escaped quotes', () => {
    const parsed = parser.parse('Empresa,Observacoes\n"Acme, Ltda","Disse ""olá"""');

    expect(parsed.rows).toEqual([{ Empresa: 'Acme, Ltda', Observacoes: 'Disse "olá"' }]);
  });

  it('removes the UTF-8 BOM from the first header', () => {
    const parsed = parser.parse('\uFEFFEmpresa,Telefone\nAcme,11999999999');

    expect(parsed.headers).toEqual(['Empresa', 'Telefone']);
  });

  it('ignores blank lines and limits previews to the first five rows', () => {
    const preview = parser.preview('Empresa\nA\n\nB\nC\nD\nE\nF\n');

    expect(preview.rows).toEqual([
      { Empresa: 'A' },
      { Empresa: 'B' },
      { Empresa: 'C' },
      { Empresa: 'D' },
      { Empresa: 'E' },
    ]);
  });

  it('aborts parsing before materializing rows above the configured limit, including previews', () => {
    const content = 'Empresa\nA\nB\nC';

    expect(() => parser.parse(content, 2)).toThrow(
      new BadRequestException('CSV file exceeds the maximum row limit'),
    );
    expect(() => parser.preview(content, 2)).toThrow(
      new BadRequestException('CSV file exceeds the maximum row limit'),
    );
  });

  it('rejects files without a usable header', () => {
    expect(() => parser.parse('\n\n')).toThrow(new BadRequestException('CSV file must include a header row'));
  });

  it('rejects malformed CSV rows without exposing parser internals', () => {
    expect(() => parser.parse('Empresa,Telefone\n"Acme,11999999999')).toThrow(
      new BadRequestException('CSV file contains malformed rows'),
    );
  });
});
