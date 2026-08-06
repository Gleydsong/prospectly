import { GoneException } from '@nestjs/common';

import { ConversionStudioController } from './conversion-studio.controller';

describe('ConversionStudioController Aura endpoints', () => {
  const controller = new ConversionStudioController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('generate returns 410 Gone', () => {
    expect(() => controller.generate()).toThrow(GoneException);
  });

  it('refine returns 410 Gone', () => {
    expect(() => controller.refine()).toThrow(GoneException);
  });
});
