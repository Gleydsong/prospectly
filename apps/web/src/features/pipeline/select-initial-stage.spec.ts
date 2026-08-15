import { describe, expect, it } from 'vitest';

import type { PipelineListItem } from '@/types';

import { selectInitialPipelineStage } from './select-initial-stage';

const pipelines: PipelineListItem[] = [
  {
    id: 'secondary',
    name: 'Secundário',
    isDefault: false,
    stages: [{ id: 'secondary-stage', name: 'Entrada', order: 0 }],
  },
  {
    id: 'default',
    name: 'Funil padrão',
    isDefault: true,
    stages: [
      { id: 'review', name: 'Em análise', order: 1 },
      { id: 'new', name: 'Novos', order: 0 },
    ],
  },
];

describe('selectInitialPipelineStage', () => {
  it('seleciona a primeira etapa ordenada do funil padrão', () => {
    expect(selectInitialPipelineStage(pipelines)).toMatchObject({ id: 'new', name: 'Novos' });
  });

  it('retorna nulo quando não existe uma etapa disponível', () => {
    expect(selectInitialPipelineStage(undefined)).toBeNull();
    expect(
      selectInitialPipelineStage([{ id: 'empty', name: 'Vazio', isDefault: true, stages: [] }]),
    ).toBeNull();
  });
});
