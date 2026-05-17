import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TimerService, TimerState } from './timer.service';
import { SessionService, SessionState } from './session.service';
import { PrismaService } from '../prisma/prisma.service';

export interface FlashMessage {
  text: string;
  duration: number; // secondes, 0 = permanent
}

export interface PanelistInfo {
  id: number;
  name: string;
  totalSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  isActive: boolean;
  order: number;
}

@WebSocketGateway()
export class TimerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private timerService: TimerService,
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const [timerState, sessionState, panelistState] = await Promise.all([
      this.timerService.getState(),
      this.sessionService.getState(),
      this.loadPanelistState(),
    ]);
    client.emit('timer_state', timerState);
    client.emit('session_state', sessionState);
    client.emit('panelist_update', panelistState);
  }

  handleDisconnect(_client: Socket) {}

  private async loadPanelistState(): Promise<PanelistInfo[]> {
    const panelists = await this.prisma.panelist.findMany({ orderBy: { order: 'asc' } });
    return panelists.map(p => {
      let elapsed = 0;
      if (p.isActive && p.activatedAt) {
        elapsed = Math.floor((Date.now() - new Date(p.activatedAt).getTime()) / 1000);
      }
      return {
        id: p.id,
        name: p.name,
        totalSeconds: p.totalSeconds,
        usedSeconds: p.usedSeconds + elapsed,
        remainingSeconds: p.totalSeconds - p.usedSeconds - elapsed,
        isActive: p.isActive,
        order: p.order,
      };
    });
  }

  broadcast(state: TimerState) {
    this.server.emit('timer_state', state);
  }

  broadcastSessionState(state: SessionState) {
    this.server.emit('session_state', state);
  }

  broadcastPanelistUpdate(state: PanelistInfo[]) {
    this.server.emit('panelist_update', state);
  }

  broadcastMessage(msg: FlashMessage) {
    this.server.emit('flash_message', msg);
  }

  broadcastClearMessage() {
    this.server.emit('flash_message', null);
  }
}
