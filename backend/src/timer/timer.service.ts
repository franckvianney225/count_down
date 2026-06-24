import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TimerState {
  remainingSeconds: number;
  isActive: boolean;
  duration: number;
  isOvertime: boolean;
}

@Injectable()
export class TimerService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.timerSettings.count();
    if (count === 0) {
      await this.prisma.timerSettings.create({
        data: { duration: 1800, remainingSeconds: 1800 },
      });
    }
  }

  async getState(): Promise<TimerState> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (!settings) {
      return { remainingSeconds: 1800, isActive: false, duration: 1800, isOvertime: false };
    }

    let remainingSeconds = settings.remainingSeconds;
    if (settings.isActive && settings.startedAt) {
      const elapsed = Math.floor((Date.now() - settings.startedAt.getTime()) / 1000);
      // Pas de Math.max → peut devenir négatif (overtime)
      remainingSeconds = settings.remainingSeconds - elapsed;
    }

    return {
      remainingSeconds,
      isActive: settings.isActive,
      duration: settings.duration,
      isOvertime: settings.isActive && remainingSeconds < 0,
    };
  }

  async setDuration(minutes: number): Promise<void> {
    const seconds = minutes * 60;
    const settings = await this.prisma.timerSettings.findFirst();
    if (settings) {
      await this.prisma.timerSettings.update({
        where: { id: settings.id },
        data: { duration: seconds, isActive: false, startedAt: null, remainingSeconds: seconds },
      });
    } else {
      await this.prisma.timerSettings.create({
        data: { duration: seconds, remainingSeconds: seconds },
      });
    }
  }

  async start(): Promise<void> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (!settings || settings.isActive) return;
    await this.prisma.timerSettings.update({
      where: { id: settings.id },
      data: { isActive: true, startedAt: new Date() },
    });
  }

  async stop(): Promise<void> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (!settings || !settings.isActive) return;
    const elapsed = settings.startedAt
      ? Math.floor((Date.now() - settings.startedAt.getTime()) / 1000)
      : 0;
    // Peut être négatif si on était en overtime au moment du stop
    const remaining = settings.remainingSeconds - elapsed;
    await this.prisma.timerSettings.update({
      where: { id: settings.id },
      data: { isActive: false, startedAt: null, remainingSeconds: remaining },
    });
  }

  async reset(): Promise<void> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (!settings) return;
    await this.prisma.timerSettings.update({
      where: { id: settings.id },
      data: { isActive: false, startedAt: null, remainingSeconds: settings.duration },
    });
  }

  async setBackgroundImage(filename: string): Promise<string> {
    const url = `/countdown/uploads/${filename}`;
    const settings = await this.prisma.timerSettings.findFirst();
    if (settings) {
      await this.prisma.timerSettings.update({ where: { id: settings.id }, data: { backgroundImageUrl: url } });
    }
    return url;
  }

  async clearBackgroundImage(): Promise<void> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (settings) {
      await this.prisma.timerSettings.update({ where: { id: settings.id }, data: { backgroundImageUrl: null } });
    }
  }

  async getBackgroundImageUrl(): Promise<string | null> {
    const settings = await this.prisma.timerSettings.findFirst();
    return settings?.backgroundImageUrl ?? null;
  }

  async setPanelPoster(filename: string): Promise<{ url: string; visible: boolean }> {
    const url = `/countdown/uploads/${filename}`;
    const settings = await this.prisma.timerSettings.findFirst();
    if (settings) {
      await this.prisma.timerSettings.update({
        where: { id: settings.id },
        data: { panelPosterUrl: url, panelPosterVisible: true },
      });
    }
    return { url, visible: true };
  }

  async clearPanelPoster(): Promise<void> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (settings) {
      await this.prisma.timerSettings.update({
        where: { id: settings.id },
        data: { panelPosterUrl: null, panelPosterVisible: false },
      });
    }
  }

  async getPanelPosterState(): Promise<{ url: string | null; visible: boolean }> {
    const settings = await this.prisma.timerSettings.findFirst();
    return { url: settings?.panelPosterUrl ?? null, visible: settings?.panelPosterVisible ?? false };
  }

  async setPanelPosterVisible(visible: boolean): Promise<boolean> {
    const settings = await this.prisma.timerSettings.findFirst();
    if (settings) {
      await this.prisma.timerSettings.update({
        where: { id: settings.id },
        data: { panelPosterVisible: visible },
      });
    }
    return visible;
  }
}
