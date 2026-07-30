import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { WaitlistService, type JoinWaitlistResult } from './waitlist.service';

@ApiTags('waitlist')
@Controller({ path: 'waitlist', version: '1' })
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post()
  async join(@Body() dto: JoinWaitlistDto): Promise<JoinWaitlistResult> {
    return this.waitlist.join(dto);
  }
}
