import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TimerService, TimerState } from './timer.service';
import { SessionService, SessionState } from './session.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoteQuestionPayload, VoteResultsPayload } from '../vote/vote.service';

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
  photoUrl: string | null;
  fonction: string | null;
  structure: string | null;
}

@WebSocketGateway()
export class TimerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private panelistsPanelVisible = false;
  private panelistsAgVisible = false;
  private preshowVisible = false;
  private commencerVisible = false;
  private backgroundImageUrl: string | null = null;
  private currentVoteQuestion: VoteQuestionPayload | null = null;
  private currentVoteResults: VoteResultsPayload | null = null;
  private voteViewers = new Map<string, Set<string>>();
  private socketToCode = new Map<string, string>();

  constructor(
    private timerService: TimerService,
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const [timerState, sessionState, panelistState, bgUrl] = await Promise.all([
      this.timerService.getState(),
      this.sessionService.getState(),
      this.loadPanelistState(),
      this.timerService.getBackgroundImageUrl(),
    ]);
    if (bgUrl) this.backgroundImageUrl = bgUrl;
    client.emit('timer_state', timerState);
    client.emit('session_state', sessionState);
    client.emit('panelist_update', panelistState);
    client.emit('panelists_panel', this.panelistsPanelVisible);
    client.emit('panelists_ag', this.panelistsAgVisible);
    client.emit('preshow', this.preshowVisible);
    client.emit('commencer', this.commencerVisible);
    client.emit('background_image', this.backgroundImageUrl);
    client.emit('vote_question', this.currentVoteQuestion);
    client.emit('vote_results', this.currentVoteResults);
  }

  handleDisconnect(client: Socket) {
    const code = this.socketToCode.get(client.id);
    if (code) {
      this.socketToCode.delete(client.id);
      const viewers = this.voteViewers.get(code);
      if (viewers) {
        viewers.delete(client.id);
        this.server.emit('vote_viewers', { code, count: viewers.size });
      }
    }
  }

  @SubscribeMessage('join_vote')
  handleJoinVote(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const prevCode = this.socketToCode.get(client.id);
    if (prevCode && prevCode !== data.code) {
      const prev = this.voteViewers.get(prevCode);
      if (prev) {
        prev.delete(client.id);
        this.server.emit('vote_viewers', { code: prevCode, count: prev.size });
      }
    }
    this.socketToCode.set(client.id, data.code);
    if (!this.voteViewers.has(data.code)) {
      this.voteViewers.set(data.code, new Set());
    }
    this.voteViewers.get(data.code)!.add(client.id);
    this.server.emit('vote_viewers', { code: data.code, count: this.voteViewers.get(data.code)!.size });
  }

  @SubscribeMessage('leave_vote')
  handleLeaveVote(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.socketToCode.delete(client.id);
    const viewers = this.voteViewers.get(data.code);
    if (viewers) {
      viewers.delete(client.id);
      this.server.emit('vote_viewers', { code: data.code, count: viewers.size });
    }
  }

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
        photoUrl: p.photoUrl,
        fonction: p.fonction,
        structure: p.structure,
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

  broadcastPanelistsPanel(visible: boolean) {
    this.panelistsPanelVisible = visible;
    this.server.emit('panelists_panel', visible);
  }

  broadcastPanelistsAg(visible: boolean) {
    this.panelistsAgVisible = visible;
    this.server.emit('panelists_ag', visible);
  }

  broadcastPreshow(visible: boolean) {
    this.preshowVisible = visible;
    this.server.emit('preshow', visible);
  }

  broadcastCommencer(visible: boolean) {
    this.commencerVisible = visible;
    this.server.emit('commencer', visible);
  }

  broadcastBackgroundImage(url: string | null) {
    this.backgroundImageUrl = url;
    this.server.emit('background_image', url);
  }

  broadcastVoteQuestion(payload: VoteQuestionPayload | null) {
    this.currentVoteQuestion = payload;
    this.server.emit('vote_question', payload);
  }

  broadcastVoteResults(payload: VoteResultsPayload | null) {
    this.currentVoteResults = payload;
    this.server.emit('vote_results', payload);
  }
}
