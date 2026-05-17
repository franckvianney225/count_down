import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TimerGateway } from '../timer/timer.gateway';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TemplateService } from './template.service';

@Controller('templates')
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly timerGateway: TimerGateway,
  ) {}

  @Get()
  getAll() {
    return this.templateService.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateTemplateDto) {
    return this.templateService.createFromCurrentSession(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/load')
  async load(@Param('id', ParseIntPipe) id: number) {
    const sessionState = await this.templateService.loadIntoSession(id);
    this.timerGateway.broadcastSessionState(sessionState);
    return sessionState;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.delete(id);
  }
}
