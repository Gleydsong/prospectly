import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { parseCorsOrigins } from './config/cors-origins';
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE, createCorsDelegate } from './config/http-surface';

process.env.ROLE = 'api';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  const nodeEnv = config.get<string>('nodeEnv') ?? process.env.NODE_ENV ?? 'development';
  app.use(
    helmet({
      hsts: nodeEnv === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  const corsOrigins = parseCorsOrigins(
    config.get<string>('corsOrigins') ??
      config.get<string>('CORS_ORIGINS') ??
      'http://localhost:5173,http://localhost:3001',
  );
  app.enableCors(createCorsDelegate(corsOrigins));

  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: API_GLOBAL_PREFIX_EXCLUDE,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Prospectly API')
      .setDescription('Plataforma inteligente para prospecção de clientes locais.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('port') ?? parseInt(process.env.PORT ?? '3000', 10);
  // Render / reverse proxies — needed for accurate @Ip() and rate limiting.
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.getInstance()?.set?.('trust proxy', 1);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
