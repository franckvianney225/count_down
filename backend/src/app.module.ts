import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TimerModule } from './timer/timer.module';
import { PanelistModule } from './panelist/panelist.module';
import { TemplateModule } from './template/template.module';
import { VoteModule } from './vote/vote.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
    PrismaModule,
    AuthModule,
    TimerModule,
    PanelistModule,
    TemplateModule,
    VoteModule,
  ],
})
export class AppModule {}
