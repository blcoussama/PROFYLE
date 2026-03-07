import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // Parse httpOnly cookies (used by JWT refresh token)
  app.use(cookieParser());

  // All routes prefixed with /api
  app.setGlobalPrefix('api');

  // CORS — allow only frontend origin, with credentials (cookies)
  app.enableCors({
    origin: config.get<string>('client.url'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe — strips unknown fields, transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger (OpenAPI) — accessible at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PROFYLE API')
    .setDescription('Job recruitment platform REST API — v2 NestJS')
    .setVersion('2.0.0')
    .addBearerAuth()
    .addCookieAuth('RefreshToken')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(`Application running on http://localhost:${port}/api`);
  logger.log(`Swagger docs at  http://localhost:${port}/api/docs`);
}

void bootstrap();
