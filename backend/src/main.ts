import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // #region agent log
  if (typeof fetch === 'function') {
    fetch('http://127.0.0.1:7621/ingest/c3bbbd3e-6e21-42e1-8865-66cc0759d70b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a344a4'},body:JSON.stringify({sessionId:'a344a4',runId:'pre-fix',hypothesisId:'H0',location:'main.ts:bootstrap',message:'Bootstrap started',data:{nodeVersion:process.version,port:process.env.PORT||'3001'},timestamp:Date.now()})}).catch(()=>{});
  } else {
    console.warn('[debugLog] fetch() is not available in bootstrap runtime');
  }
  // #endregion
  const app = await NestFactory.create(AppModule);

  // Enable cookie parsing
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('Attendance API')
    .setDescription('Attendance System API Documentation')
    .setVersion('1.0')
    .addTag('attendance')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3001);
  console.log(`Application is running on: http://localhost:${process.env.PORT || 3001}`);
}
bootstrap();
