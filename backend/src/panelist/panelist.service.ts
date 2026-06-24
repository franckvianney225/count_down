import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePanelistDto } from './dto/create-panelist.dto';
import { UpdatePanelistDto } from './dto/update-panelist.dto';

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
  phaseIds: number[];
}

@Injectable()
export class PanelistService {
  constructor(private readonly prisma: PrismaService) {}

  private compute(p: {
    id: number;
    name: string;
    totalSeconds: number;
    usedSeconds: number;
    isActive: boolean;
    activatedAt: Date | null;
    order: number;
    photoUrl: string | null;
    fonction: string | null;
    structure: string | null;
    panelistPhases: { phaseId: number }[];
  }): PanelistInfo {
    let elapsed = 0;
    if (p.isActive && p.activatedAt) {
      elapsed = Math.floor((Date.now() - new Date(p.activatedAt).getTime()) / 1000);
    }
    const remaining = p.totalSeconds - p.usedSeconds - elapsed;
    return {
      id: p.id,
      name: p.name,
      totalSeconds: p.totalSeconds,
      usedSeconds: p.usedSeconds + elapsed,
      remainingSeconds: remaining,
      isActive: p.isActive,
      order: p.order,
      photoUrl: p.photoUrl,
      fonction: p.fonction,
      structure: p.structure,
      phaseIds: p.panelistPhases.map(pp => pp.phaseId),
    };
  }

  async getAll(): Promise<PanelistInfo[]> {
    const panelists = await this.prisma.panelist.findMany({
      orderBy: { order: 'asc' },
      include: { panelistPhases: { select: { phaseId: true } } },
    });
    return panelists.map(p => this.compute(p));
  }

  async create(dto: CreatePanelistDto): Promise<PanelistInfo[]> {
    const count = await this.prisma.panelist.count();
    await this.prisma.panelist.create({
      data: {
        name: dto.name,
        totalSeconds: dto.totalSeconds,
        order: count,
        fonction: dto.fonction ?? null,
        structure: dto.structure ?? null,
        panelistPhases: dto.phaseIds?.length
          ? { create: dto.phaseIds.map(phaseId => ({ phaseId })) }
          : undefined,
      },
    });
    return this.getAll();
  }

  async update(id: number, data: UpdatePanelistDto): Promise<PanelistInfo[]> {
    await this.prisma.panelist.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.fonction !== undefined ? { fonction: data.fonction } : {}),
        ...(data.structure !== undefined ? { structure: data.structure } : {}),
        ...(data.totalSeconds !== undefined ? { totalSeconds: data.totalSeconds } : {}),
      },
    });

    if (data.phaseIds !== undefined) {
      await this.prisma.panelistPhase.deleteMany({ where: { panelistId: id } });
      if (data.phaseIds.length > 0) {
        await this.prisma.panelistPhase.createMany({
          data: data.phaseIds.map(phaseId => ({ panelistId: id, phaseId })),
        });
      }
    }

    return this.getAll();
  }

  async uploadPhoto(id: number, filename: string): Promise<PanelistInfo[]> {
    await this.prisma.panelist.update({
      where: { id },
      data: { photoUrl: `/countdown/uploads/${filename}` },
    });
    return this.getAll();
  }

  async delete(id: number): Promise<PanelistInfo[]> {
    await this.stopActive();
    await this.prisma.panelist.delete({ where: { id } });
    return this.getAll();
  }

  async clearAll(): Promise<PanelistInfo[]> {
    await this.prisma.panelist.deleteMany({});
    return [];
  }

  async activate(id: number): Promise<PanelistInfo[]> {
    await this.stopActive();
    await this.prisma.panelist.update({
      where: { id },
      data: { isActive: true, activatedAt: new Date() },
    });
    return this.getAll();
  }

  async stop(): Promise<PanelistInfo[]> {
    await this.stopActive();
    return this.getAll();
  }

  async resetOne(id: number): Promise<PanelistInfo[]> {
    await this.prisma.panelist.update({
      where: { id },
      data: { usedSeconds: 0, isActive: false, activatedAt: null },
    });
    return this.getAll();
  }

  async resetAll(): Promise<PanelistInfo[]> {
    await this.prisma.panelist.updateMany({
      data: { usedSeconds: 0, isActive: false, activatedAt: null },
    });
    return this.getAll();
  }

  private async stopActive(): Promise<void> {
    const active = await this.prisma.panelist.findFirst({ where: { isActive: true } });
    if (!active || !active.activatedAt) return;
    const elapsed = Math.floor((Date.now() - new Date(active.activatedAt).getTime()) / 1000);
    await this.prisma.panelist.update({
      where: { id: active.id },
      data: {
        usedSeconds: active.usedSeconds + elapsed,
        isActive: false,
        activatedAt: null,
      },
    });
  }
}
