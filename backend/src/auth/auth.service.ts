import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(password: string): Promise<{ token: string }> {
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    if (!adminPassword || password !== adminPassword) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }
    const token = this.jwtService.sign({ role: 'admin' });
    return { token };
  }
}
