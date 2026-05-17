import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TimerGateway } from '../timer/timer.gateway';
import { CreatePanelistDto } from './dto/create-panelist.dto';
import { PanelistService } from './panelist.service';

@Controller('panelists')
export class PanelistController {
  constructor(
    private readonly panelistService: PanelistService,
    private readonly timerGateway: TimerGateway,
  ) {}

  @Get()
  async getAll() {
    return this.panelistService.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreatePanelistDto) {
    const state = await this.panelistService.create(dto);
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('all')
  async clearAll() {
    const state = await this.panelistService.clearAll();
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    const state = await this.panelistService.delete(id);
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/activate')
  async activate(@Param('id', ParseIntPipe) id: number) {
    const state = await this.panelistService.activate(id);
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('stop')
  async stop() {
    const state = await this.panelistService.stop();
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reset')
  async resetOne(@Param('id', ParseIntPipe) id: number) {
    const state = await this.panelistService.resetOne(id);
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-all')
  async resetAll() {
    const state = await this.panelistService.resetAll();
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }
}
