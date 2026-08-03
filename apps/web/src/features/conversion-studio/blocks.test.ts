import { moveBlock } from './utils/blocks';
import { createBlock, pageBlocksSchema } from './types/blocks';

describe('conversion studio blocks', () => {
  it('creates and reorders blocks without drag-and-drop', () => {
    const a = createBlock('hero');
    const b = createBlock('rich_text');
    const moved = moveBlock([a, b], b.id, -1);
    expect(moved[0]?.id).toBe(b.id);
    expect(moved[1]?.id).toBe(a.id);
  });

  it('rejects unsafe external URLs', () => {
    const parsed = pageBlocksSchema.safeParse([
      {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'cta_button',
        label: 'Go',
        action: { type: 'external_url', url: 'http://insecure.example' },
        variant: 'brand',
      },
    ]);
    expect(parsed.success).toBe(false);
  });
});
