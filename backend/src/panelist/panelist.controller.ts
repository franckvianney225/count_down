import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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

  @UseGuards(JwtAuthGuard)
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: '/app/uploads',
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, `panelist-${unique}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(jpg|jpeg|png|webp|gif)$/i;
      cb(null, allowed.test(file.originalname));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const state = await this.panelistService.uploadPhoto(id, file.filename);
    this.timerGateway.broadcastPanelistUpdate(state);
    return state;
  }
}
