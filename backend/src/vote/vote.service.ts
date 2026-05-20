import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  options: { id: number; label: string; order: number }[];
}

@Injectable()
export class VoteService {
  constructor(private prisma: PrismaService) {}

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
    return questions.map(q => ({
      id: q.id,
      code: q.code,
      question: q.question,
      isActive: q.isActive,
      isClosed: q.isClosed,
      showResults: q.showResults,
      options: q.options.map(o => ({ id: o.id, label: o.label, order: o.order })),
    }));
  }

  async getActive(): Promise<VoteQuestionPayload | null> {
    const q = await this.prisma.voteQuestion.findFirst({
      where: { isActive: true },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!q) return null;
    return {
      id: q.id,
      code: q.code,
      question: q.question,
      isActive: q.isActive,
      isClosed: q.isClosed,
      showResults: q.showResults,
      options: q.options.map(o => ({ id: o.id, label: o.label, order: o.order })),
    };
  }

  async getByCode(code: string): Promise<VoteQuestionPayload | null> {
    const q = await this.prisma.voteQuestion.findUnique({
      where: { code },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!q) return null;
    return {
      id: q.id,
      code: q.code,
      question: q.question,
      isActive: q.isActive,
      isClosed: q.isClosed,
      showResults: q.showResults,
      options: q.options.map(o => ({ id: o.id, label: o.label, order: o.order })),
    };
  }

  async activate(id: number): Promise<VoteQuestionPayload> {
    // Désactive toutes les autres questions
    await this.prisma.voteQuestion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    const q = await this.prisma.voteQuestion.update({
      where: { id },
      data: { isActive: true, isClosed: false },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return {
      id: q.id,
      code: q.code,
      question: q.question,
      isActive: q.isActive,
      isClosed: q.isClosed,
      showResults: q.showResults,
      options: q.options.map(o => ({ id: o.id, label: o.label, order: o.order })),
    };
  }

  async close(id: number): Promise<VoteQuestionPayload> {
    const q = await this.prisma.voteQuestion.update({
      where: { id },
      data: { isActive: false, isClosed: true },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return {
      id: q.id,
      code: q.code,
      question: q.question,
      isActive: q.isActive,
      isClosed: q.isClosed,
      showResults: q.showResults,
      options: q.options.map(o => ({ id: o.id, label: o.label, order: o.order })),
    };
  }

  async toggleResults(id: number, show: boolean): Promise<VoteResultsPayload> {
    await this.prisma.voteQuestion.update({ where: { id }, data: { showResults: show } });
    return this.getResults(id);
  }

  async castVote(questionId: number, dto: CastVoteDto): Promise<VoteResultsPayload> {
    const question = await this.prisma.voteQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question introuvable');
    if (!question.isActive || question.isClosed) throw new BadRequestException('Ce vote est fermé');

    const option = await this.prisma.voteOption.findFirst({
      where: { id: dto.optionId, questionId },
    });
    if (!option) throw new NotFoundException('Option introuvable');

    const existing = await this.prisma.voteResponse.findUnique({
      where: { token_questionId: { token: dto.token, questionId } },
    });
    if (existing) throw new ConflictException('Vous avez déjà voté');

    await this.prisma.voteResponse.create({
      data: { token: dto.token, questionId, optionId: dto.optionId },
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

  async deleteQuestion(id: number): Promise<void> {
    await this.prisma.voteQuestion.delete({ where: { id } });
  }

  async resetQuestion(id: number): Promise<VoteResultsPayload> {
    await this.prisma.voteResponse.deleteMany({ where: { questionId: id } });
    return this.getResults(id);
  }
}
