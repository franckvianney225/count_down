import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetupSessionDto } from './dto/setup-session.dto';

export interface PhaseInfo {
  id: number;
  name: string;
  duration: number;
  order: number;
}

export interface SessionState {
  sessionId: number | null;
  sessionName: string;
  phases: PhaseInfo[];
  currentPhaseIndex: number;
  remainingSeconds: number;
  currentPhaseDuration: number;
  isActive: boolean;
  isOvertime: boolean;
}

const EMPTY_STATE: SessionState = {
  sessionId: null,
  sessionName: 'Session',
  phases: [],
  currentPhaseIndex: 0,
  remainingSeconds: 0,
  currentPhaseDuration: 0,
  isActive: false,
  isOvertime: false,
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(): Promise<SessionState> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });

    if (!session || session.phases.length === 0) return EMPTY_STATE;

    const phases = session.phases.map(p => ({
      id: p.id,
      name: p.name,
      duration: p.duration,
      order: p.order,
    }));

    const currentPhase = phases[session.currentPhaseIndex];
    if (!currentPhase) return EMPTY_STATE;

    let remainingSeconds: number;

    if (!session.isActive) {
      remainingSeconds = session.pausedRemaining ?? currentPhase.duration;
    } else {
      const elapsed = Math.floor((Date.now() - new Date(session.startedAt!).getTime()) / 1000);
      const base = session.pausedRemaining ?? currentPhase.duration;
      remainingSeconds = base - elapsed;
    }

    return {
      sessionId: session.id,
      sessionName: session.name,
      phases,
      currentPhaseIndex: session.currentPhaseIndex,
      remainingSeconds,
      currentPhaseDuration: currentPhase.duration,
      isActive: session.isActive,
      isOvertime: session.isActive && remainingSeconds < 0,
    };
  }

  async deleteSession(): Promise<SessionState> {
    await this.prisma.eventSession.deleteMany({});
    return EMPTY_STATE;
  }

  async setup(dto: SetupSessionDto): Promise<SessionState> {
    await this.prisma.eventSession.deleteMany({});

    await this.prisma.eventSession.create({
      data: {
        name: dto.name ?? 'Session',
        currentPhaseIndex: 0,
        isActive: false,
        startedAt: null,
        pausedRemaining: null,
        phases: {
          create: dto.phases.map(p => ({
            name: p.name,
            duration: p.duration,
            order: p.order,
          })),
        },
      },
    });

    return this.getState();
  }

  async start(): Promise<SessionState> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });
    if (!session || session.phases.length === 0) return EMPTY_STATE;

    await this.prisma.eventSession.update({
      where: { id: session.id },
      data: { isActive: true, startedAt: new Date() },
    });

    return this.getState();
  }

  async stop(): Promise<SessionState> {
    const state = await this.getState();
    if (!state.sessionId) return EMPTY_STATE;

    await this.prisma.eventSession.update({
      where: { id: state.sessionId },
      data: {
        isActive: false,
        pausedRemaining: state.remainingSeconds,
        startedAt: null,
      },
    });

    return this.getState();
  }

  async nextPhase(): Promise<SessionState> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });
    if (!session || session.phases.length === 0) return EMPTY_STATE;

    const nextIndex = Math.min(session.currentPhaseIndex + 1, session.phases.length - 1);

    await this.prisma.eventSession.update({
      where: { id: session.id },
      data: {
        currentPhaseIndex: nextIndex,
        pausedRemaining: null,
        startedAt: session.isActive ? new Date() : null,
      },
    });

    return this.getState();
  }

  async prevPhase(): Promise<SessionState> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });
    if (!session || session.phases.length === 0) return EMPTY_STATE;

    const prevIndex = Math.max(session.currentPhaseIndex - 1, 0);

    await this.prisma.eventSession.update({
      where: { id: session.id },
      data: {
        currentPhaseIndex: prevIndex,
        pausedRemaining: null,
        startedAt: session.isActive ? new Date() : null,
      },
    });

    return this.getState();
  }

  async addPhases(phases: { name: string; duration: number }[]): Promise<SessionState> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });
    if (!session) return EMPTY_STATE;

    const maxOrder = session.phases.reduce((max, p) => Math.max(max, p.order), -1);

    await this.prisma.phase.createMany({
      data: phases.map((p, i) => ({
        name: p.name,
        duration: p.duration,
        order: maxOrder + 1 + i,
        sessionId: session.id,
      })),
    });

    return this.getState();
  }

  async updatePhase(id: number, data: { name?: string; duration?: number }): Promise<SessionState> {
    const phase = await this.prisma.phase.findUnique({
      where: { id },
      include: { session: { include: { phases: { orderBy: { order: 'asc' } } } } },
    });
    if (!phase) return EMPTY_STATE;

    const session = phase.session;
    const isCurrentPhase = session.phases[session.currentPhaseIndex]?.id === id;

    if (session.isActive && isCurrentPhase && data.duration !== undefined) {
      return this.getState();
    }

    await this.prisma.phase.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.duration !== undefined ? { duration: data.duration } : {}),
      },
    });

    return this.getState();
  }

  async deletePhase(id: number): Promise<SessionState> {
    const phase = await this.prisma.phase.findUnique({
      where: { id },
      include: { session: { include: { phases: { orderBy: { order: 'asc' } } } } },
    });
    if (!phase) return EMPTY_STATE;

    const session = phase.session;
    const wasBeforeCurrent = phase.order < session.phases[session.currentPhaseIndex]?.order;
    const isCurrentPhase = session.phases[session.currentPhaseIndex]?.id === id;

    await this.prisma.phase.delete({ where: { id } });

    const remainingPhases = await this.prisma.phase.count({
      where: { sessionId: session.id },
    });

    if (remainingPhases === 0) {
      await this.prisma.eventSession.delete({ where: { id: session.id } });
      return EMPTY_STATE;
    }

    let newIndex = session.currentPhaseIndex;
    if (wasBeforeCurrent || (isCurrentPhase && session.currentPhaseIndex > 0)) {
      newIndex = Math.max(0, session.currentPhaseIndex - 1);
    }

    await this.prisma.eventSession.update({
      where: { id: session.id },
      data: {
        currentPhaseIndex: newIndex,
        pausedRemaining: null,
        startedAt: session.isActive ? new Date() : null,
      },
    });

    return this.getState();
  }

  async resetPhase(): Promise<SessionState> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });
    if (!session || session.phases.length === 0) return EMPTY_STATE;

    await this.prisma.eventSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        pausedRemaining: null,
        startedAt: null,
      },
    });

    return this.getState();
  }
}
