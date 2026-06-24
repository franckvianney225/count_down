import { Body, Controller, Post, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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

  @Post('background-image')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: '/app/uploads',
      filename: (_req, file, cb) => cb(null, `bg-${Date.now()}${extname(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Image uniquement'), false);
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadBackgroundImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier');
    const url = await this.timerService.setBackgroundImage(file.filename);
    this.timerGateway.broadcastBackgroundImage(url);
    return { url };
  }

  @Post('background-image/clear')
  async clearBackgroundImage() {
    await this.timerService.clearBackgroundImage();
    this.timerGateway.broadcastBackgroundImage(null);
    return { success: true };
  }

  @Post('panel-poster')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: '/app/uploads',
      filename: (_req, file, cb) => cb(null, `poster-${Date.now()}${extname(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Image uniquement'), false);
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadPanelPoster(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier');
    const { url, visible } = await this.timerService.setPanelPoster(file.filename);
    this.timerGateway.broadcastPanelPoster({ url, visible });
    return { url, visible };
  }

  @Post('panel-poster/clear')
  async clearPanelPoster() {
    await this.timerService.clearPanelPoster();
    this.timerGateway.broadcastPanelPoster({ url: null, visible: false });
    return { success: true };
  }

  @Post('panel-poster/toggle')
  async togglePanelPoster(@Body() body: { visible: boolean }) {
    const visible = await this.timerService.setPanelPosterVisible(body.visible);
    const state = await this.timerService.getPanelPosterState();
    this.timerGateway.broadcastPanelPoster(state);
    return { visible };
  }
}
