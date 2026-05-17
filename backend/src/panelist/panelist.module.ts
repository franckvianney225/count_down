import { Module } from '@nestjs/common';
import { TimerModule } from '../timer/timer.module';
import { PanelistController } from './panelist.controller';
import { PanelistService } from './panelist.service';

@Module({
  imports: [TimerModule],
  controllers: [PanelistController],
  providers: [PanelistService],
})
export class PanelistModule {}
