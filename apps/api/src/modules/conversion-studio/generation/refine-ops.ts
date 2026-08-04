import { randomUUID } from 'node:crypto';

import {
  assertPublishableBlocks,
  parsePageBlocks,
  type PageBlock,
} from '../page-blocks.schema';

export type RefineOp =
  | { op: 'update'; blockId: string; patch: Record<string, unknown> }
  | { op: 'replace'; blockId: string; block: unknown }
  | { op: 'remove'; blockId: string }
  | { op: 'insert'; afterBlockId?: string; block: unknown };

export type RefineModelResponse = {
  title?: string;
  ops?: RefineOp[];
  blocks?: unknown;
};

export function applyRefineResponse(
  currentBlocks: PageBlock[],
  currentTitle: string,
  raw: RefineModelResponse,
): { title: string; blocks: PageBlock[] } {
  if (Array.isArray(raw.ops) && raw.ops.length > 0) {
    const next = applyOps(currentBlocks, raw.ops);
    const blocks = parsePageBlocks(next);
    assertPublishableBlocks(blocks);
    const title =
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 160)
        : currentTitle;
    return { title, blocks };
  }

  if (raw.blocks != null) {
    const withIds = ensureBlockIds(raw.blocks);
    const blocks = parsePageBlocks(withIds);
    assertPublishableBlocks(blocks);
    const title =
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 160)
        : currentTitle;
    return { title, blocks };
  }

  throw new Error('Refine response missing ops or blocks');
}

function applyOps(blocks: PageBlock[], ops: RefineOp[]): unknown[] {
  let next: Array<Record<string, unknown>> = blocks.map((block) => ({
    ...(block as unknown as Record<string, unknown>),
  }));

  for (const op of ops.slice(0, 20)) {
    if (op.op === 'remove') {
      next = next.filter((block) => block.id !== op.blockId);
      continue;
    }

    if (op.op === 'update') {
      const index = next.findIndex((block) => block.id === op.blockId);
      if (index < 0) continue;
      const current = next[index]!;
      const { id: _id, type: _type, ...safePatch } = op.patch;
      next[index] = { ...current, ...safePatch, id: current.id, type: current.type };
      continue;
    }

    if (op.op === 'replace') {
      const index = next.findIndex((block) => block.id === op.blockId);
      if (index < 0) continue;
      const replacement = asBlockRecord(op.block, String(next[index]!.id));
      next[index] = replacement;
      continue;
    }

    if (op.op === 'insert') {
      const insertion = asBlockRecord(op.block);
      if (!op.afterBlockId) {
        next.push(insertion);
        continue;
      }
      const index = next.findIndex((block) => block.id === op.afterBlockId);
      if (index < 0) {
        next.push(insertion);
      } else {
        next.splice(index + 1, 0, insertion);
      }
    }
  }

  return next;
}

function asBlockRecord(block: unknown, forcedId?: string): Record<string, unknown> {
  if (!block || typeof block !== 'object') {
    throw new Error('Invalid block in refine op');
  }
  const row = block as Record<string, unknown>;
  return {
    ...row,
    id: forcedId ?? (typeof row.id === 'string' ? row.id : randomUUID()),
  };
}

function ensureBlockIds(blocks: unknown): unknown {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    const row = block as Record<string, unknown>;
    if (typeof row.id === 'string' && row.id.length > 0) return row;
    return { ...row, id: randomUUID() };
  });
}
