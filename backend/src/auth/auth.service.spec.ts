import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock_token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('admin123') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('retourne un token avec le bon mot de passe', async () => {
    const result = await service.login('admin123');
    expect(result).toEqual({ token: 'mock_token' });
  });

  it('lève UnauthorizedException avec un mauvais mot de passe', async () => {
    await expect(service.login('mauvais')).rejects.toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si ADMIN_PASSWORD non défini', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const svc = module.get<AuthService>(AuthService);
    await expect(svc.login('')).rejects.toThrow(UnauthorizedException);
  });
});
