import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { VoteService } from './vote.service';
import { TimerGateway } from '../timer/timer.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CastVoteDto } from './dto/cast-vote.dto';

@Controller('vote')
export class VoteController {
  constructor(
    private voteService: VoteService,
    private timerGateway: TimerGateway,
  ) {}

  /* ── Routes publiques ── */

  @Get('active')
  getActive() {
    return this.voteService.getActive();
  }

  @Get('code/:code')
  async getByCode(@Param('code') code: string) {
    const q = await this.voteService.getByCode(code);
    if (!q) throw new NotFoundException('Vote introuvable');
    return q;
  }

  @Get('code/:code/results')
  async getResultsByCode(@Param('code') code: string) {
    const q = await this.voteService.getByCode(code);
    if (!q) throw new NotFoundException('Vote introuvable');
    return this.voteService.getResults(q.id);
  }

  @Post(':id/cast')
  async castVote(@Param('id', ParseIntPipe) id: number, @Body() dto: CastVoteDto) {
    const results = await this.voteService.castVote(id, dto);
    this.timerGateway.broadcastVoteResults(results);
    return results;
  }

  @Get(':id/results')
  getResults(@Param('id', ParseIntPipe) id: number) {
    return this.voteService.getResults(id);
  }

  /* ── Routes admin ── */

  @Get()
  @UseGuards(JwtAuthGuard)
  getAll() {
    return this.voteService.getAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createQuestion(@Body() dto: CreateQuestionDto) {
    return this.voteService.createQuestion(dto);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard)
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { durationSeconds?: number },
  ) {
    const question = await this.voteService.activate(id, body?.durationSeconds);
    this.timerGateway.broadcastVoteQuestion(question);
    const results = await this.voteService.getResults(id);
    this.timerGateway.broadcastVoteResults(results);
    return question;
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard)
  async close(@Param('id', ParseIntPipe) id: number) {
    const question = await this.voteService.close(id);
    this.timerGateway.broadcastVoteQuestion(question);
    return question;
  }

  @Post(':id/show-results')
  @UseGuards(JwtAuthGuard)
  async showResults(@Param('id', ParseIntPipe) id: number) {
    const results = await this.voteService.toggleResults(id, true);
    this.timerGateway.broadcastVoteResults(results);
    return results;
  }

  @Post(':id/hide-results')
  @UseGuards(JwtAuthGuard)
  async hideResults(@Param('id', ParseIntPipe) id: number) {
    const results = await this.voteService.toggleResults(id, false);
    this.timerGateway.broadcastVoteResults(results);
    return results;
  }

  @Post(':id/reset')
  @UseGuards(JwtAuthGuard)
  async resetQuestion(@Param('id', ParseIntPipe) id: number) {
    const results = await this.voteService.resetQuestion(id);
    this.timerGateway.broadcastVoteResults(results);
    return results;
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard)
  async exportCsv(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const csv = await this.voteService.exportCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vote_${id}_resultats.csv"`);
    res.send('﻿' + csv);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteQuestion(@Param('id', ParseIntPipe) id: number) {
    await this.voteService.deleteQuestion(id);
    this.timerGateway.broadcastVoteQuestion(null);
    this.timerGateway.broadcastVoteResults(null);
    return { success: true };
  }
}
