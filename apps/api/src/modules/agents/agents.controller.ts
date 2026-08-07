import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AgentsService } from './agents.service';
import {
  AgentsCrmApplyDto,
  AgentsLeadDto,
  AgentsWhatsappFirstMessageDto,
  AgentsWhatsappVariantsDto,
} from './dto/agents.dto';

@ApiTags('agents')
@ApiBearerAuth()
@Controller({ path: 'agents', version: '1' })
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER', 'VIEWER')
  catalog() {
    return this.agents.catalog();
  }

  @Post('crm/suggest')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  suggestCrm(@CurrentOrg() organizationId: string, @Body() dto: AgentsLeadDto) {
    return this.agents.suggestCrm(organizationId, dto.leadId);
  }

  @Post('crm/apply')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  applyCrm(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AgentsCrmApplyDto,
  ) {
    return this.agents.applyCrm(organizationId, user.id, dto.leadId, dto.stageId);
  }

  @Post('whatsapp/first-message')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  whatsappFirstMessage(
    @CurrentOrg() organizationId: string,
    @Body() dto: AgentsWhatsappFirstMessageDto,
  ) {
    return this.agents.whatsappFirstMessage(organizationId, dto.leadId, dto.templateId);
  }

  @Post('whatsapp/variants')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  whatsappVariants(
    @CurrentOrg() organizationId: string,
    @Body() dto: AgentsWhatsappVariantsDto,
  ) {
    return this.agents.whatsappVariants(organizationId, dto.leadId, dto.count);
  }
}
