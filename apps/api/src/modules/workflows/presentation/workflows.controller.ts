import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../../common/decorators/current-org.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { WorkflowsService } from '../application/workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller({ path: 'workflows', version: '1' })
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  list(@CurrentOrg() organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workflows.list(organizationId, user);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflows.create(organizationId, user, dto);
  }

  @Get(':id')
  getById(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.get(organizationId, user, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  update(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflows.update(organizationId, user, id, dto);
  }

  @Post(':id/publish')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  publish(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.publish(organizationId, user, id);
  }

  @Post(':id/pause')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  pause(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.pause(organizationId, user, id);
  }

  @Post(':id/resume')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  resume(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.resume(organizationId, user, id);
  }

  @Post(':id/archive')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  archive(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workflows.archive(organizationId, user, id);
  }
}
