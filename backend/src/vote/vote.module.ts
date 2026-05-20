import { Module } from '@nestjs/common';
import { VoteService } from './vote.service';
import { VoteController } from './vote.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TimerModule } from '../timer/timer.module';

@Module({
  imports: [PrismaModule, TimerModule],
  controllers: [VoteController],
  providers: [VoteService],
})
export class VoteModule {}
