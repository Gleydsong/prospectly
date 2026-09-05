import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller({ version: '1' })
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('tasks')
  list(@CurrentOrg() organizationId: string, @Query() query: QueryTasksDto) {
    return this.tasks.list(organizationId, query);
  }

  @Post('tasks')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(organizationId, user.id, dto);
  }

  @Post('leads/:leadId/tasks')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  createForLead(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(organizationId, user.id, { ...dto, leadId });
  }

  @Patch('tasks/:id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  update(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(organizationId, id, user.id, dto);
  }

  @Delete('tasks/:id')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.tasks.remove(organizationId, id);
  }
}
