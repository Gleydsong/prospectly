import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export const CSV_IMPORT_FIELDS = [
  'companyName',
  'phone',
  'email',
  'website',
  'category',
  'address',
  'city',
  'state',
  'postalCode',
  'notes',
  'tags',
] as const;

export type CsvImportField = (typeof CSV_IMPORT_FIELDS)[number];
export type CsvRow = Record<string, string>;

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  delimiter: ',' | ';';
}

export interface CsvPreview {
  headers: string[];
  rows: CsvRow[];
  suggestedMapping: Partial<Record<CsvImportField, string>>;
}

const FIELD_ALIASES: Record<CsvImportField, string[]> = {
  companyName: ['empresa', 'nome da empresa', 'nome empresa', 'razao social', 'company name'],
  phone: ['telefone', 'fone', 'celular', 'phone'],
  email: ['email', 'e mail', 'e-mail'],
  website: ['site', 'website', 'url'],
  category: ['categoria', 'category', 'segmento'],
  address: ['endereco', 'endereço', 'logradouro', 'address'],
  city: ['cidade', 'city', 'municipio', 'município'],
  state: ['uf', 'estado', 'state'],
  postalCode: ['cep', 'codigo postal', 'código postal', 'postal code'],
  notes: ['observacoes', 'observações', 'notas', 'notes'],
  tags: ['tags', 'tag', 'etiquetas'],
};

@Injectable()
export class CsvParserService {
  parse(content: string, maxRows = Number.POSITIVE_INFINITY): ParsedCsv {
    const normalized = content.replace(/^\uFEFF/, '');
    if (!normalized.trim()) {
      throw new BadRequestException('CSV file must include a header row');
    }

    try {
      const rows = parse(normalized, {
        bom: true,
        columns: true,
        delimiter: this.detectDelimiter(normalized),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: false,
        ...(Number.isFinite(maxRows) ? { to: maxRows + 1 } : {}),
      }) as CsvRow[];
      const headers = this.readHeaders(normalized);
      if (!headers.length || headers.some((header) => !header)) {
        throw new BadRequestException('CSV file must include a header row');
      }
      if (rows.length > maxRows) {
        throw new BadRequestException('CSV file exceeds the maximum row limit');
      }
      return { headers, rows, delimiter: this.detectDelimiter(normalized) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('CSV file contains malformed rows');
    }
  }

  preview(content: string, maxRows = Number.POSITIVE_INFINITY): CsvPreview {
    const parsed = this.parse(content, maxRows);
    return {
      headers: parsed.headers,
      rows: parsed.rows.slice(0, 5),
      suggestedMapping: this.suggestMapping(parsed.headers),
    };
  }

  private readHeaders(content: string): string[] {
    const [headers] = parse(content, {
      bom: true,
      delimiter: this.detectDelimiter(content),
      from_line: 1,
      to_line: 1,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
    return headers ?? [];
  }

  private detectDelimiter(content: string): ',' | ';' {
    const headerLine = content.split(/\r?\n/, 1)[0] ?? '';
    return this.countUnquoted(headerLine, ';') > this.countUnquoted(headerLine, ',') ? ';' : ',';
  }

  private countUnquoted(value: string, target: ',' | ';'): number {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] === '"') {
        if (quoted && value[index + 1] === '"') {
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && value[index] === target) {
        count += 1;
      }
    }
    return count;
  }

  private suggestMapping(headers: string[]): Partial<Record<CsvImportField, string>> {
    const byNormalizedHeader = new Map(headers.map((header) => [this.normalizeHeader(header), header]));
    return Object.fromEntries(
      CSV_IMPORT_FIELDS.flatMap((field) => {
        const match = FIELD_ALIASES[field]
          .map((alias) => byNormalizedHeader.get(this.normalizeHeader(alias)))
          .find(Boolean);
        return match ? [[field, match]] : [];
      }),
    ) as Partial<Record<CsvImportField, string>>;
  }

  private normalizeHeader(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
