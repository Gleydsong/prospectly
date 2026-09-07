import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomFieldType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

export const CUSTOM_FIELD_API_TYPES = ['text', 'number', 'select', 'date'] as const;
export type CustomFieldApiType = (typeof CUSTOM_FIELD_API_TYPES)[number];

export const MAX_ACTIVE_FIELDS = 20;
export const MAX_SELECT_OPTIONS = 30;
export const MAX_NAME_LENGTH = 120;
export const MAX_TEXT_LENGTH = 500;
export const MAX_NUMBER_ABS = 1_000_000_000_000;
export const MAX_DECIMAL_PLACES = 4;
const DATE_MIN = '1900-01-01';
const DATE_MAX = '2100-12-31';

export type SelectOption = {
  id: string;
  label: string;
  archivedAt: string | null;
};

export type CustomFieldDefinitionView = {
  id: string;
  name: string;
  type: CustomFieldApiType;
  position: number;
  archivedAt: string | null;
  options: SelectOption[];
};

type StoredOption = {
  id: string;
  label: string;
  archivedAt: string | null;
};

const TYPE_TO_API: Record<CustomFieldType, CustomFieldApiType> = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  DATE: 'date',
};

const API_TO_TYPE: Record<CustomFieldApiType, CustomFieldType> = {
  text: CustomFieldType.TEXT,
  number: CustomFieldType.NUMBER,
  select: CustomFieldType.SELECT,
  date: CustomFieldType.DATE,
};

function isApiType(value: string): value is CustomFieldApiType {
  return (CUSTOM_FIELD_API_TYPES as readonly string[]).includes(value);
}

function parseOptions(value: unknown): StoredOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.label !== 'string') return [];
    return [
      {
        id: row.id,
        label: row.label,
        archivedAt: typeof row.archivedAt === 'string' ? row.archivedAt : null,
      },
    ];
  });
}

function asValuesMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function decimalPlaces(value: number): number {
  const text = value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
  const index = text.indexOf('.');
  if (index < 0) return 0;
  return text.length - index - 1;
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<CustomFieldDefinitionView[]> {
    const rows = await this.prisma.customFieldDefinition.findMany({
      where: { organizationId },
      orderBy: [{ archivedAt: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    organizationId: string,
    input: { name: string; type: string; options?: Array<{ label: string }> },
  ): Promise<CustomFieldDefinitionView> {
    const name = this.requireName(input.name);
    if (!isApiType(input.type)) {
      throw new BadRequestException('Type must be text, number, select or date');
    }
    const type = API_TO_TYPE[input.type];
    const options = this.buildCreateOptions(type, input.options);
    await this.assertActiveCapacity(organizationId);
    await this.assertUniqueActiveName(organizationId, name);

    const last = await this.prisma.customFieldDefinition.findFirst({
      where: { organizationId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await this.prisma.customFieldDefinition.create({
      data: {
        organizationId,
        name,
        type,
        position: (last?.position ?? -1) + 1,
        options: options as Prisma.InputJsonValue,
      },
    });
    return this.toView(created);
  }

  async update(
    organizationId: string,
    id: string,
    input: {
      name?: string;
      type?: string;
      options?: Array<{ id?: string; label: string; archived?: boolean }>;
    },
  ): Promise<CustomFieldDefinitionView> {
    const current = await this.requireDefinition(organizationId, id);
    if (input.type !== undefined && API_TO_TYPE[input.type as CustomFieldApiType] !== current.type) {
      throw new BadRequestException('Type cannot change after create');
    }
    const name =
      input.name === undefined ? current.name : this.requireName(input.name);
    if (name !== current.name && !current.archivedAt) {
      await this.assertUniqueActiveName(organizationId, name, id);
    }
    const options =
      input.options === undefined
        ? parseOptions(current.options)
        : this.mergeOptions(current.type, parseOptions(current.options), input.options);

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: { name, options: options as Prisma.InputJsonValue },
    });
    return this.toView(updated);
  }

  async archive(organizationId: string, id: string): Promise<CustomFieldDefinitionView> {
    const current = await this.requireDefinition(organizationId, id);
    if (current.archivedAt) return this.toView(current);
    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return this.toView(updated);
  }

  async unarchive(organizationId: string, id: string): Promise<CustomFieldDefinitionView> {
    const current = await this.requireDefinition(organizationId, id);
    if (!current.archivedAt) return this.toView(current);
    await this.assertActiveCapacity(organizationId);
    await this.assertUniqueActiveName(organizationId, current.name, id);
    const last = await this.prisma.customFieldDefinition.findFirst({
      where: { organizationId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: { archivedAt: null, position: (last?.position ?? -1) + 1 },
    });
    return this.toView(updated);
  }

  async reorder(organizationId: string, ids: string[]): Promise<CustomFieldDefinitionView[]> {
    const active = await this.prisma.customFieldDefinition.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(active.map((row) => row.id));
    if (ids.length !== activeIds.size || ids.some((id) => !activeIds.has(id))) {
      throw new BadRequestException('Reorder must list every active field once');
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.customFieldDefinition.update({ where: { id }, data: { position } }),
      ),
    );
    return this.list(organizationId);
  }

  async mergeValues(
    organizationId: string,
    current: unknown,
    patch: Record<string, unknown>,
  ): Promise<Prisma.InputJsonObject> {
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { organizationId },
    });
    const byId = new Map(definitions.map((row) => [row.id, row]));
    const next = asValuesMap(current);

    for (const [fieldId, raw] of Object.entries(patch)) {
      const definition = byId.get(fieldId);
      if (!definition) {
        throw new BadRequestException('Unknown custom field');
      }
      if (definition.archivedAt) {
        throw new BadRequestException('Archived custom field is read-only');
      }
      if (raw === null || raw === '' || (typeof raw === 'string' && raw.trim() === '')) {
        delete next[fieldId];
        continue;
      }
      next[fieldId] = this.validateValue(definition, raw, asValuesMap(current)[fieldId]);
    }
    return next as Prisma.InputJsonObject;
  }

  private validateValue(
    definition: { type: CustomFieldType; options: Prisma.JsonValue },
    raw: unknown,
    previous: unknown,
  ): string | number {
    if (definition.type === CustomFieldType.TEXT) {
      if (typeof raw !== 'string') {
        throw new BadRequestException('Text value must be a string');
      }
      const text = raw.trim();
      if (text.length > MAX_TEXT_LENGTH) {
        throw new BadRequestException(`Text cannot exceed ${MAX_TEXT_LENGTH} characters`);
      }
      return text;
    }
    if (definition.type === CustomFieldType.NUMBER) {
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isFinite(value)) {
        throw new BadRequestException('Number must be finite');
      }
      if (Math.abs(value) > MAX_NUMBER_ABS) {
        throw new BadRequestException('Number is out of range');
      }
      if (decimalPlaces(value) > MAX_DECIMAL_PLACES) {
        throw new BadRequestException(`Number cannot have more than ${MAX_DECIMAL_PLACES} decimal places`);
      }
      return value;
    }
    if (definition.type === CustomFieldType.DATE) {
      if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw new BadRequestException('Date must be YYYY-MM-DD');
      }
      if (raw < DATE_MIN || raw > DATE_MAX) {
        throw new BadRequestException('Date is out of range');
      }
      const year = Number(raw.slice(0, 4));
      const month = Number(raw.slice(5, 7));
      const day = Number(raw.slice(8, 10));
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) {
        throw new BadRequestException('Date is invalid');
      }
      return raw;
    }
    if (typeof raw !== 'string') {
      throw new BadRequestException('Select value must be an option id');
    }
    const options = parseOptions(definition.options);
    const option = options.find((item) => item.id === raw);
    if (!option) {
      throw new BadRequestException('Unknown select option');
    }
    if (option.archivedAt && previous !== raw) {
      throw new BadRequestException('Archived select option cannot be chosen');
    }
    return raw;
  }

  private buildCreateOptions(
    type: CustomFieldType,
    options: Array<{ label: string }> | undefined,
  ): StoredOption[] {
    if (type !== CustomFieldType.SELECT) {
      if (options?.length) {
        throw new BadRequestException('Only select fields have options');
      }
      return [];
    }
    if (!options?.length) {
      throw new BadRequestException('Select field needs at least one option');
    }
    if (options.length > MAX_SELECT_OPTIONS) {
      throw new BadRequestException(`Select cannot have more than ${MAX_SELECT_OPTIONS} options`);
    }
    return options.map((option) => ({
      id: randomUUID(),
      label: this.requireName(option.label),
      archivedAt: null,
    }));
  }

  private mergeOptions(
    type: CustomFieldType,
    current: StoredOption[],
    incoming: Array<{ id?: string; label: string; archived?: boolean }>,
  ): StoredOption[] {
    if (type !== CustomFieldType.SELECT) {
      throw new BadRequestException('Only select fields have options');
    }
    const byId = new Map(current.map((option) => [option.id, { ...option }]));
    for (const item of incoming) {
      const label = this.requireName(item.label);
      if (item.id) {
        const existing = byId.get(item.id);
        if (!existing) {
          throw new BadRequestException('Unknown select option');
        }
        existing.label = label;
        if (item.archived === true && !existing.archivedAt) {
          existing.archivedAt = new Date().toISOString();
        }
        if (item.archived === false) {
          const active = [...byId.values()].filter((option) => !option.archivedAt).length;
          if (existing.archivedAt && active >= MAX_SELECT_OPTIONS) {
            throw new BadRequestException(`Select cannot have more than ${MAX_SELECT_OPTIONS} options`);
          }
          existing.archivedAt = null;
        }
        continue;
      }
      const active = [...byId.values()].filter((option) => !option.archivedAt).length;
      if (active >= MAX_SELECT_OPTIONS) {
        throw new BadRequestException(`Select cannot have more than ${MAX_SELECT_OPTIONS} options`);
      }
      const created: StoredOption = { id: randomUUID(), label, archivedAt: null };
      byId.set(created.id, created);
    }
    return [...byId.values()];
  }

  private requireName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Name is required');
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new BadRequestException(`Name cannot exceed ${MAX_NAME_LENGTH} characters`);
    }
    return trimmed;
  }

  private async assertActiveCapacity(organizationId: string) {
    const count = await this.prisma.customFieldDefinition.count({
      where: { organizationId, archivedAt: null },
    });
    if (count >= MAX_ACTIVE_FIELDS) {
      throw new BadRequestException(`Organization cannot have more than ${MAX_ACTIVE_FIELDS} active fields`);
    }
  }

  private async assertUniqueActiveName(organizationId: string, name: string, excludeId?: string) {
    const clash = await this.prisma.customFieldDefinition.findFirst({
      where: {
        organizationId,
        name,
        archivedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException('An active field already uses this name');
    }
  }

  private async requireDefinition(organizationId: string, id: string) {
    const row = await this.prisma.customFieldDefinition.findFirst({
      where: { id, organizationId },
    });
    if (!row) {
      throw new NotFoundException('Custom field not found');
    }
    return row;
  }

  private toView(row: {
    id: string;
    name: string;
    type: CustomFieldType;
    position: number;
    archivedAt: Date | null;
    options: Prisma.JsonValue;
  }): CustomFieldDefinitionView {
    return {
      id: row.id,
      name: row.name,
      type: TYPE_TO_API[row.type],
      position: row.position,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      options: parseOptions(row.options),
    };
  }
}
