import { describe, expect, it } from 'vitest';

import {
  TASK_STATUS_LABELS,
  formatActivityType,
  formatMessageTemplateCategory,
  formatSearchImportStatus,
} from './presentation-labels';

describe('rótulos de apresentação', () => {
  it('traduz estados de tarefas e importações', () => {
    expect(TASK_STATUS_LABELS.OPEN).toBe('Aberta');
    expect(TASK_STATUS_LABELS.IN_PROGRESS).toBe('Em andamento');
    expect(formatSearchImportStatus('IMPORTED')).toBe('Importado');
    expect(formatSearchImportStatus('CONFLICT')).toBe('Possível duplicidade');
  });

  it('traduz tipos de atividade e categorias de modelos', () => {
    expect(formatActivityType('NOTE')).toBe('Nota');
    expect(formatActivityType('UNKNOWN')).toBe('Atividade');
    expect(formatMessageTemplateCategory('EMAIL')).toBe('E-mail');
    expect(formatMessageTemplateCategory('UNKNOWN')).toBe('Outra categoria');
  });
});
