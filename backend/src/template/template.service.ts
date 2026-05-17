import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService, SessionState } from '../timer/session.service';
import { CreateTemplateDto } from './dto/create-template.dto';

export interface TemplatePhaseInfo {
  name: string;
  duration: number;
  order: number;
}

export interface TemplateInfo {
  id: number;
  name: string;
  createdAt: string;
  phaseCount: number;
  totalDuration: number;
  phases: TemplatePhaseInfo[];
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async getAll(): Promise<TemplateInfo[]> {
    const templates = await this.prisma.eventTemplate.findMany({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt.toISOString(),
      phaseCount: t.phases.length,
      totalDuration: t.phases.reduce((sum, p) => sum + p.duration, 0),
      phases: t.phases.map(p => ({ name: p.name, duration: p.duration, order: p.order })),
    }));
  }

  async createFromCurrentSession(dto: CreateTemplateDto): Promise<TemplateInfo[]> {
    const session = await this.prisma.eventSession.findFirst({
      include: { phases: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'desc' },
    });

    if (!session || session.phases.length === 0) {
      throw new BadRequestException('Aucune session avec des phases à sauvegarder.');
    }

    await this.prisma.eventTemplate.create({
      data: {
        name: dto.name,
        phases: {
          create: session.phases.map(p => ({
            name: p.name,
            duration: p.duration,
            order: p.order,
          })),
        },
      },
    });

    return this.getAll();
  }

  async loadIntoSession(id: number): Promise<SessionState> {
    const template = await this.prisma.eventTemplate.findUnique({
      where: { id },
      include: { phases: { orderBy: { order: 'asc' } } },
    });

    if (!template) throw new NotFoundException('Template introuvable.');

    return this.sessionService.setup({
      name: template.name,
      phases: template.phases.map(p => ({
        name: p.name,
        duration: p.duration,
        order: p.order,
      })),
    });
  }

  async delete(id: number): Promise<TemplateInfo[]> {
    await this.prisma.eventTemplate.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Template introuvable.');
    });
    return this.getAll();
  }
}
