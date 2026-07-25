import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('current')
  getCurrent(@CurrentOrg() organizationId: string) {
    return this.organizations.getCurrent(organizationId);
  }

  @Patch('current')
  @Roles('OWNER', 'ADMIN')
  update(@CurrentOrg() organizationId: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(organizationId, dto.name);
  }

  @Get('members')
  listMembers(@CurrentOrg() organizationId: string) {
    return this.organizations.listMembers(organizationId);
  }

  @Post('members')
  @Roles('OWNER', 'ADMIN')
  inviteMember(@CurrentOrg() organizationId: string, @Body() dto: InviteMemberDto) {
    return this.organizations.inviteMember(organizationId, dto);
  }

  @Patch('members/:memberId')
  @Roles('OWNER', 'ADMIN')
  updateMemberRole(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizations.updateMemberRole(
      organizationId,
      memberId,
      dto.role,
      user.id,
      user.role,
    );
  }

  @Delete('members/:memberId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    await this.organizations.removeMember(organizationId, memberId, user.id);
  }
}
