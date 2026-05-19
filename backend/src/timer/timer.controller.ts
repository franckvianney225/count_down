import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TimerService } from './timer.service';
import { TimerGateway } from './timer.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SetDurationDto } from './dto/set-duration.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('timer')
@UseGuards(JwtAuthGuard)
export class TimerController {
  constructor(
    private timerService: TimerService,
    private timerGateway: TimerGateway,
  ) {}

  @Post('set-duration')
  async setDuration(@Body() dto: SetDurationDto) {
    await this.timerService.setDuration(dto.duration);
    const state = await this.timerService.getState();
    this.timerGateway.broadcast(state);
    return { success: true };
  }

  @Post('start')
  async start() {
    await this.timerService.start();
    const state = await this.timerService.getState();
    this.timerGateway.broadcast(state);
    return { success: true };
  }

  @Post('stop')
  async stop() {
    await this.timerService.stop();
    const state = await this.timerService.getState();
    this.timerGateway.broadcast(state);
    return { success: true };
  }

  @Post('reset')
  async reset() {
    await this.timerService.reset();
    const state = await this.timerService.getState();
    this.timerGateway.broadcast(state);
    return { success: true };
  }

  @Post('message')
  sendMessage(@Body() dto: SendMessageDto) {
    this.timerGateway.broadcastMessage({ text: dto.text, duration: dto.duration });
    return { success: true };
  }

  @Post('message/clear')
  clearMessage() {
    this.timerGateway.broadcastClearMessage();
    return { success: true };
  }

  @Post('panelists-panel')
  togglePanelistsPanel(@Body() body: { visible: boolean }) {
    this.timerGateway.broadcastPanelistsPanel(body.visible);
    return { success: true };
  }

  @Post('panelists-ag')
  togglePanelistsAg(@Body() body: { visible: boolean }) {
    this.timerGateway.broadcastPanelistsAg(body.visible);
    return { success: true };
  }

  @Post('preshow')
  togglePreshow(@Body() body: { visible: boolean }) {
    this.timerGateway.broadcastPreshow(body.visible);
    return { success: true };
  }

  @Post('commencer')
  toggleCommencer(@Body() body: { visible: boolean }) {
    this.timerGateway.broadcastCommencer(body.visible);
    return { success: true };
  }
}
