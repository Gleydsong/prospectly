import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LeadPipelineStepper, findStageForStatus } from './lead-pipeline-stepper';

const stages = [
  { id: 'stage-new', name: 'Novos', order: 0 },
  { id: 'stage-review', name: 'Em análise', order: 1 },
  { id: 'stage-qualified', name: 'Qualificados', order: 2 },
];

describe('LeadPipelineStepper', () => {
  it('lets the seller move the lead with one click on a later stage', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<LeadPipelineStepper stages={stages} currentStageId="stage-new" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Em análise' }));
    expect(onSelect).toHaveBeenCalledWith(stages[1]);
  });

  it('does not re-submit the current stage', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <LeadPipelineStepper stages={stages} currentStageId="stage-review" onSelect={onSelect} />,
    );

    await user.click(screen.getByRole('button', { name: 'Em análise' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('maps lead status to corresponding pipeline stage', () => {
    expect(findStageForStatus(stages, 'NEW')?.id).toBe('stage-new');
    expect(findStageForStatus(stages, 'IN_ANALYSIS')?.id).toBe('stage-review');
    expect(findStageForStatus(stages, 'QUALIFIED')?.id).toBe('stage-qualified');
    expect(findStageForStatus(stages, 'UNKNOWN')).toBeUndefined();
    expect(findStageForStatus(stages, null)).toBeUndefined();
  });
});
