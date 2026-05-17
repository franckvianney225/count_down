import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SetupSessionDto } from './dto/setup-session.dto';
import { SessionService } from './session.service';
import { TimerGateway } from './timer.gateway';

@Controller('session')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly timerGateway: TimerGateway,
  ) {}

  @Get()
  async getState() {
    return this.sessionService.getState();
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async deleteSession() {
    const state = await this.sessionService.deleteSession();
    this.timerGateway.broadcastSessionState(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup')
  async setup(@Body() dto: SetupSessionDto) {
    const state = await this.sessionService.setup(dto);
    this.timerGateway.broadcastSessionState(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('start')
  async start() {
    const state = await this.sessionService.start();
    this.timerGateway.broadcastSessionState(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('stop')
  async stop() {
    const state = await this.sessionService.stop();
    this.timerGateway.broadcastSessionState(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('next')
  async nextPhase() {
    const state = await this.sessionService.nextPhase();
    this.timerGateway.broadcastSessionState(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('prev')
  async prevPhase() {
    const state = await this.sessionService.prevPhase();
    this.timerGateway.broadcastSessionState(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset')
  async resetPhase() {
    const state = await this.sessionService.resetPhase();
    this.timerGateway.broadcastSessionState(state);
    return state;
  }
}
