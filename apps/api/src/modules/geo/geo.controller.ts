import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { QueryCitiesDto, QueryRegionsDto } from './dto/query-geo.dto';
import { GeoService } from './geo.service';

@ApiTags('geo')
@ApiBearerAuth()
@Controller({ path: 'geo', version: '1' })
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('regions')
  listRegions(@Query() query: QueryRegionsDto) {
    return this.geo.listRegions(query.country);
  }

  @Get('cities')
  listCities(@Query() query: QueryCitiesDto) {
    return this.geo.listCities(query.country, query.region);
  }
}
