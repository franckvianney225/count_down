import { Module } from '@nestjs/common';
import { TimerModule } from '../timer/timer.module';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [TimerModule],
  controllers: [TemplateController],
  providers: [TemplateService],
})
export class TemplateModule {}
