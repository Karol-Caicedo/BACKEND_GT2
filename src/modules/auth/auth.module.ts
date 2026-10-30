import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { PasswordReset } from './password-reset.entity';
import { SsoCode } from './sso-code.entity';
import { LoginChallenge } from './login-challenge.entity';
import { AuthService } from './auth.service';
import { LoginCryptoService } from './login-crypto.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { MicrosoftStrategy } from './microsoft.strategy';
import { SsoEnabledGuard } from './sso-enabled.guard';
import { getJwtSecret } from '../../config/jwt.config';

@Module({
  imports: [
    UsersModule,
    MailModule,
    TypeOrmModule.forFeature([PasswordReset, SsoCode, LoginChallenge]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: getJwtSecret(c),
        signOptions: { algorithm: 'HS256', expiresIn: (c.get('JWT_EXPIRES_IN', '12h') as string) as never },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginCryptoService, JwtStrategy, GoogleStrategy, MicrosoftStrategy, SsoEnabledGuard],
  exports: [AuthService],
})
export class AuthModule {}
