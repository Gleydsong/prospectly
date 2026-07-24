import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSearchDto } from './dto/create-search.dto';
import { ImportSearchResultsDto } from './dto/import-search-results.dto';
import { QuerySearchesDto } from './dto/query-searches.dto';
import { ProspectingService } from './prospecting.service';

@ApiTags('prospecting')
@ApiBearerAuth()
@Controller({ path: 'searches', version: '1' })
export class ProspectingController {
  constructor(private readonly prospecting: ProspectingService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSearchDto,
    @CorrelationId() correlationId?: string,
  ) {
    return this.prospecting.create(organizationId, user.id, dto, correlationId);
  }

  @Get('providers')
  listProviders() {
    return this.prospecting.listProviders();
  }

  @Get()
  list(@CurrentOrg() organizationId: string, @Query() query: QuerySearchesDto) {
    return this.prospecting.list(organizationId, query);
  }

  @Get(':id')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.prospecting.get(organizationId, id);
  }

  @Get(':id/results')
  listResults(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuerySearchesDto,
  ) {
    return this.prospecting.listResults(organizationId, id, query);
  }

  @Post(':id/import')
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  importResults(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportSearchResultsDto,
  ) {
    return this.prospecting.importResults(organizationId, user.id, id, dto.resultIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  remove(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.prospecting.remove(organizationId, id);
  }
}