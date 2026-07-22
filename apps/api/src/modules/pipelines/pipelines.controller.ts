import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MoveLeadStageDto } from './dto/move-lead-stage.dto';
import { PipelinesService } from './pipelines.service';

@ApiTags('pipelines')
@ApiBearerAuth()
@Controller({ version: '1' })
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get('pipelines')
  list(@CurrentOrg() organizationId: string) {
    return this.pipelines.list(organizationId);
  }

  @Get('pipelines/board')
  getBoard(@CurrentOrg() organizationId: string, @Query('pipelineId') pipelineId?: string) {
    return this.pipelines.getBoard(organizationId, pipelineId);
  }

  @Patch('leads/:id/stage')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  moveLeadToStage(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveLeadStageDto,
  ) {
    return this.pipelines.moveLeadToStage(organizationId, id, dto.stageId, user.id);
  }
}
