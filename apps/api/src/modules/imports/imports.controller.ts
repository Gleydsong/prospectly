import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCsvImportDto } from './dto/create-csv-import.dto';
import { QueryImportsDto } from './dto/query-imports.dto';
import { ImportsService } from './imports.service';


interface UploadedCsvFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

@ApiTags('imports')
@ApiBearerAuth()
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('csv/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  preview(@UploadedFile() file: UploadedCsvFile | undefined) {
    const uploaded = this.requireFile(file);
    return this.imports.preview(uploaded.originalname, uploaded.buffer);
  }

  @RequireEmailVerified()
  @Post('csv')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('OWNER', 'ADMIN', 'SALES', 'MEMBER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'mapping'],
      properties: {
        file: { type: 'string', format: 'binary' },
        mapping: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  })
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() dto: CreateCsvImportDto,
    @CorrelationId() correlationId?: string,
  ) {
    const uploaded = this.requireFile(file);
    return this.imports.createFromFile(
      organizationId,
      user.id,
      uploaded.originalname,
      uploaded.buffer,
      dto.mapping,
      correlationId,
    );
  }

  @Get()
  list(@CurrentOrg() organizationId: string, @Query() query: QueryImportsDto) {
    return this.imports.list(organizationId, query);
  }

  @Get(':id')
  get(@CurrentOrg() organizationId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.get(organizationId, id);
  }

  @Get(':id/errors')
  listErrors(
    @CurrentOrg() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryImportsDto,
  ) {
    return this.imports.listErrors(organizationId, id, query);
  }

  private requireFile(file: UploadedCsvFile | undefined): UploadedCsvFile {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('CSV file is required');
    }
    return file;
  }
}
