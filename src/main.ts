import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';

const cookieParser = require('cookie-parser');
async function bootstrap() {
  const adapter = new ExpressAdapter();
  adapter.set('trust proxy', 1);
  const app = await NestFactory.create(AppModule, adapter);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  const config = new DocumentBuilder()
    .setTitle('ElektroPanel API')
    .setDescription('API documentation for ElektroPanel')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'Bearer token',
    )
    .addServer('/api') // 👈 Key change: Set base path to /api
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v2', app, document);

  app.enableCors({
    origin: [
      'https://panel.deyvid.dev'       // Prod frontend
    ],
    credentials: true,                 // If you're sending cookies/auth
  });
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));

  await app.listen(port, '0.0.0.0');
  console.log(`Server running on port ${port}`);
}
bootstrap();
