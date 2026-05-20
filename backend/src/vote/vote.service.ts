import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimerGateway } from '../timer/timer.gateway';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CastVoteDto } from './dto/cast-vote.dto';

export interface VoteResultsPayload {
  questionId: number;
  code: string;
  question: string;
  total: number;
  isClosed: boolean;
  showResults: boolean;
  options: { id: number; label: string; count: number; percentage: number }[];
}

export interface VoteQuestionPayload {
  id: number;
  code: string;
  question: string;
  isActive: boolean;
  isClosed: boolean;
  showResults: boolean;
  multiChoice: boolean;
  closesAt: string | null;
  options: { id: number; label: string; order: number }[];
}

@Injectable()
export class VoteService {
  private closeTimers = new Map<number, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private gateway: TimerGateway,
  ) {}

  private generateCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async createQuestion(dto: CreateQuestionDto): Promise<VoteQuestionPayload[]> {
    await this.prisma.voteQuestion.create({
      data: {
        code: this.generateCode(),
        question: dto.question,
        multiChoice: dto.multiChoice ?? false,
        options: {
          create: dto.options.map((label, i) => ({ label, order: i })),
        },
      },
    });
    return this.getAll();
  }

  async getAll(): Promise<VoteQuestionPayload[]> {
    const questions = await this.prisma.voteQuestion.findMany({
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return questions.map(q => this.toPayload(q));
  }

  private toPayload(q: { id: number; code: string; question: string; isActive: boolean; isClosed: boolean; showResults: boolean; multiChoice: boolean; closesAt: Date | null; options: { id: number; label: string; order: number }[] }): VoteQuestionPayload {
    return {
      id: q.id,
      code: q.code,
      question: q.question,
      isActive: q.isActive,
      isClosed: q.isClosed,
      showResults: q.showResults,
      multiChoice: q.multiChoice,
      closesAt: q.closesAt ? q.closesAt.toISOString() : null,
      options: q.options.map(o => ({ id: o.id, label: o.label, order: o.order })),
    };
  }

  async getActive(): Promise<VoteQuestionPayload | null> {
    const q = await this.prisma.voteQuestion.findFirst({
      where: { isActive: true },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return q ? this.toPayload(q) : null;
  }

  async getByCode(code: string): Promise<VoteQuestionPayload | null> {
    const q = await this.prisma.voteQuestion.findUnique({
      where: { code },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return q ? this.toPayload(q) : null;
  }

  async activate(id: number, durationSeconds?: number): Promise<VoteQuestionPayload> {
    // Annule le timer précédent si existant
    if (this.closeTimers.has(id)) {
      clearTimeout(this.closeTimers.get(id));
      this.closeTimers.delete(id);
    }
    const closesAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;

    await this.prisma.voteQuestion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    const q = await this.prisma.voteQuestion.update({
      where: { id },
      data: { isActive: true, isClosed: false, closesAt },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    if (durationSeconds) {
      const timer = setTimeout(async () => {
        this.closeTimers.delete(id);
        const closed = await this.close(id);
        const results = await this.getResults(id);
        this.gateway.broadcastVoteQuestion(closed);
        this.gateway.broadcastVoteResults(results);
      }, durationSeconds * 1000);
      this.closeTimers.set(id, timer);
    }

    return this.toPayload(q);
  }

  async close(id: number): Promise<VoteQuestionPayload> {
    if (this.closeTimers.has(id)) {
      clearTimeout(this.closeTimers.get(id));
      this.closeTimers.delete(id);
    }
    const q = await this.prisma.voteQuestion.update({
      where: { id },
      data: { isActive: false, isClosed: true, closesAt: null },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return this.toPayload(q);
  }

  async toggleResults(id: number, show: boolean): Promise<VoteResultsPayload> {
    await this.prisma.voteQuestion.update({ where: { id }, data: { showResults: show } });
    return this.getResults(id);
  }

  async castVote(questionId: number, dto: CastVoteDto): Promise<VoteResultsPayload> {
    const question = await this.prisma.voteQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question introuvable');
    if (!question.isActive || question.isClosed) throw new BadRequestException('Ce vote est fermé');

    const optionIds = dto.optionIds;

    if (!question.multiChoice && optionIds.length > 1) {
      throw new BadRequestException('Ce vote n\'autorise qu\'une seule réponse');
    }

    const validOptions = await this.prisma.voteOption.findMany({
      where: { id: { in: optionIds }, questionId },
    });
    if (validOptions.length !== optionIds.length) throw new NotFoundException('Option introuvable');

    const existingVote = await this.prisma.voteResponse.findFirst({
      where: { token: dto.token, questionId, optionId: { in: optionIds } },
    });
    if (existingVote) throw new ConflictException('Vous avez déjà voté');

    await this.prisma.voteResponse.createMany({
      data: optionIds.map(optionId => ({ token: dto.token, questionId, optionId })),
      skipDuplicates: true,
    });

    return this.getResults(questionId);
  }

  async getResults(questionId: number): Promise<VoteResultsPayload> {
    const question = await this.prisma.voteQuestion.findUnique({
      where: { id: questionId },
      include: {
        options: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { responses: true } } },
        },
      },
    });
    if (!question) throw new NotFoundException('Question introuvable');

    const total = question.options.reduce((s, o) => s + o._count.responses, 0);
    return {
      questionId: question.id,
      code: question.code,
      question: question.question,
      total,
      isClosed: question.isClosed,
      showResults: question.showResults,
      options: question.options.map(o => ({
        id: o.id,
        label: o.label,
        count: o._count.responses,
        percentage: total > 0 ? Math.round((o._count.responses / total) * 1000) / 10 : 0,
      })),
    };
  }

  async exportCsv(id: number): Promise<string> {
    const results = await this.getResults(id);
    const question = await this.prisma.voteQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question introuvable');

    const lines: string[] = [
      `"Question","${results.question.replace(/"/g, '""')}"`,
      `"Total","${results.total}"`,
      `"Statut","${results.isClosed ? 'Fermé' : 'En cours'}"`,
      ``,
      `"Option","Votes","Pourcentage"`,
    ];
    for (const opt of results.options) {
      lines.push(`"${opt.label.replace(/"/g, '""')}","${opt.count}","${opt.percentage}%"`);
    }
    return lines.join('\n');
  }

  async deleteQuestion(id: number): Promise<void> {
    await this.prisma.voteQuestion.delete({ where: { id } });
  }

  async resetQuestion(id: number): Promise<VoteResultsPayload> {
    await this.prisma.voteResponse.deleteMany({ where: { questionId: id } });
    return this.getResults(id);
  }
}
