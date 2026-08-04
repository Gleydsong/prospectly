import { applyRefineResponse } from './refine-ops';
import type { PageBlock } from '../page-blocks.schema';

const heroId = '11111111-1111-1111-1111-111111111111';
const formId = '22222222-2222-2222-2222-222222222222';
const footerId = '33333333-3333-3333-3333-333333333333';

const baseBlocks = [
  {
    id: heroId,
    type: 'hero',
    headline: 'Barbearia',
    cta: { type: 'open_form', formBlockId: formId },
    ctaLabel: 'Contacto',
    variant: 'brand',
  },
  {
    id: formId,
    type: 'contact_form',
    title: 'Fale connosco',
    submitLabel: 'Enviar',
    privacyNotice: 'Privacidade',
    fields: ['name', 'email', 'message'],
  },
  {
    id: footerId,
    type: 'footer',
    text: '© 2026',
    showProspectlyBrand: true,
  },
] as PageBlock[];

describe('applyRefineResponse', () => {
  it('applies incremental update ops without rewriting all blocks', () => {
    const result = applyRefineResponse(baseBlocks, 'Barbearia', {
      ops: [{ op: 'update', blockId: heroId, patch: { headline: 'Barbearia Nacuca' } }],
    });
    expect(result.blocks[0]).toMatchObject({ id: heroId, headline: 'Barbearia Nacuca' });
    expect(result.blocks).toHaveLength(3);
  });

  it('supports full blocks fallback', () => {
    const result = applyRefineResponse(baseBlocks, 'Old', {
      title: 'New title',
      blocks: baseBlocks.map((block) =>
        block.type === 'hero' ? { ...block, headline: 'Atualizado' } : block,
      ),
    });
    expect(result.title).toBe('New title');
    expect(result.blocks[0]).toMatchObject({ headline: 'Atualizado' });
  });
});
