import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import * as cookieParser from 'cookie-parser';

class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:8005',
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8005',
    credentials: true,
  });

  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const port = process.env.PORT || 8006;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
