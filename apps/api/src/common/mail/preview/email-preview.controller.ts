import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../../decorators/public.decorator';
import { EMAIL_PREVIEW_IDS, isEmailPreviewId, renderEmailPreview } from './email-preview.fixtures';

@ApiExcludeController()
@Public()
@Controller({ path: 'email-preview', version: '1' })
export class EmailPreviewController {
  @Get()
  list() {
    return {
      templates: EMAIL_PREVIEW_IDS.map((id) => ({
        id,
        path: `/api/v1/email-preview/${id}`,
      })),
    };
  }

  @Get(':id')
  render(@Param('id') id: string, @Res() res: Response): void {
    if (!isEmailPreviewId(id)) {
      throw new NotFoundException('Unknown email preview');
    }
    const content = renderEmailPreview(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.send(content.html);
  }
}
