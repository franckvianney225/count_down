import { Test, TestingModule } from '@nestjs/testing';
import { TimerService } from './timer.service';
import { PrismaService } from '../prisma/prisma.service';

const baseSettings = {
  id: 1,
  duration: 1800,
  isActive: false,
  startedAt: null,
  remainingSeconds: 1800,
  lastUpdated: new Date(),
};

describe('TimerService', () => {
  let service: TimerService;
  let mockPrisma: { timerSettings: Record<string, jest.Mock> };

  beforeEach(async () => {
    mockPrisma = {
      timerSettings: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({ ...baseSettings }),
        update: jest.fn().mockResolvedValue({ ...baseSettings }),
        create: jest.fn().mockResolvedValue({ ...baseSettings }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TimerService>(TimerService);
  });

  describe('getState()', () => {
    it('retourne isActive false quand le timer est arrêté', async () => {
      const state = await service.getState();
      expect(state.isActive).toBe(false);
      expect(state.remainingSeconds).toBe(1800);
      expect(state.isOvertime).toBe(false);
    });

    it('calcule le temps restant quand le timer tourne', async () => {
      const startedAt = new Date(Date.now() - 60_000);
      mockPrisma.timerSettings.findFirst.mockResolvedValue({
        ...baseSettings,
        isActive: true,
        startedAt,
        remainingSeconds: 1800,
      });
      const state = await service.getState();
      expect(state.isActive).toBe(true);
      expect(state.remainingSeconds).toBeCloseTo(1740, -1);
      expect(state.isOvertime).toBe(false);
    });

    it('retourne isOvertime=true et remainingSeconds négatif en overtime', async () => {
      // Démarré il y a 35 min sur un timer de 30 min → 5 min de dépassement
      const startedAt = new Date(Date.now() - 35 * 60_000);
      mockPrisma.timerSettings.findFirst.mockResolvedValue({
        ...baseSettings,
        isActive: true,
        startedAt,
        remainingSeconds: 30 * 60, // 1800s
      });
      const state = await service.getState();
      expect(state.isActive).toBe(true);
      expect(state.isOvertime).toBe(true);
      expect(state.remainingSeconds).toBeLessThan(0);
      expect(state.remainingSeconds).toBeCloseTo(-300, -1); // ~-5 min
    });
  });

  describe('setDuration()', () => {
    it('convertit les minutes en secondes et remet à zéro', async () => {
      await service.setDuration(45);
      expect(mockPrisma.timerSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ duration: 2700, remainingSeconds: 2700, isActive: false }),
        }),
      );
    });
  });

  describe('start()', () => {
    it('active le timer avec startedAt = now', async () => {
      await service.start();
      expect(mockPrisma.timerSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('ne fait rien si déjà actif', async () => {
      mockPrisma.timerSettings.findFirst.mockResolvedValue({ ...baseSettings, isActive: true });
      await service.start();
      expect(mockPrisma.timerSettings.update).not.toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('sauvegarde le temps restant et désactive', async () => {
      const startedAt = new Date(Date.now() - 30_000);
      mockPrisma.timerSettings.findFirst.mockResolvedValue({
        ...baseSettings,
        isActive: true,
        startedAt,
        remainingSeconds: 1800,
      });
      await service.stop();
      const updateCall = mockPrisma.timerSettings.update.mock.calls[0][0];
      expect(updateCall.data.isActive).toBe(false);
      expect(updateCall.data.remainingSeconds).toBeCloseTo(1770, -1);
    });
  });

  describe('reset()', () => {
    it('remet remainingSeconds à la durée initiale', async () => {
      mockPrisma.timerSettings.findFirst.mockResolvedValue({
        ...baseSettings,
        remainingSeconds: 500,
        duration: 1800,
      });
      await service.reset();
      expect(mockPrisma.timerSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ remainingSeconds: 1800, isActive: false }),
        }),
      );
    });
  });
});
