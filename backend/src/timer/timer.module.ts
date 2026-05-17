import { Module, forwardRef } from '@nestjs/common';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';
import { TimerGateway } from './timer.gateway';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';

@Module({
  controllers: [TimerController, SessionController],
  providers: [TimerService, TimerGateway, SessionService],
  exports: [TimerGateway, SessionService],
})
export class TimerModule {}
