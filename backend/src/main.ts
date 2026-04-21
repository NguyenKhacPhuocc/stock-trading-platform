import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser(process.env.COOKIE_SECRET));

  const corsOrigins = process.env.FRONTEND_URL?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? ['http://localhost:3000', 'http://localhost:3001'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // bỏ qua field không khai báo trong DTO
      forbidNonWhitelisted: true,
      transform: true, // tự động convert type (string → number...)
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.BACKEND_PORT ?? 3002;
  await app.listen(port);
  console.log(`Backend chạy tại http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
