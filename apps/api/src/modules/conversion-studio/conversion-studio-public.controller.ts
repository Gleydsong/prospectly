import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { ConversionStudioService } from './conversion-studio.service';
import { PublicFormSubmitDto, TrackPublicEventDto } from './dto/conversion-page.dto';

@ApiTags('conversion-studio-public')
@Controller({ path: 'public/pages', version: '1' })
export class ConversionStudioPublicController {
  constructor(private readonly studio: ConversionStudioService) {}

  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.studio.getPublicBySlug(slug);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':slug/events')
  track(@Param('slug') slug: string, @Body() dto: TrackPublicEventDto) {
    return this.studio.trackPublic(slug, dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':slug/forms')
  submit(@Param('slug') slug: string, @Body() dto: PublicFormSubmitDto) {
    return this.studio.submitPublicForm(slug, dto);
  }
}
