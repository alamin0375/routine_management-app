import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import type { PrismaClient, User } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';
import {
  emailTakenError,
  invalidCredentialsError,
  invalidRefreshTokenError,
} from './errors.js';

// Auth business logic (TECHNICAL_ARCHITECTURE.md §5): argon2id passwords,
// short-lived HS256 access tokens, rotating refresh tokens stored hashed.
// Routes stay thin; everything stateful lives here.

interface TokenPair {
  accessToken: string;
  refreshToken: string; // raw value for the cookie; only its hash is stored
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class AuthService {
  private readonly jwtKey: Uint8Array;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: Env,
  ) {
    this.jwtKey = new TextEncoder().encode(env.JWT_SECRET);
  }

  async signup(email: string, password: string, timezone: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw emailTakenError();

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: normalizedEmail, passwordHash, timezone },
    });
    return { user, tokens: await this.issueTokens(user.id) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    // Verify against a dummy hash when the user is missing so response time
    // doesn't reveal whether the email exists.
    if (!user?.passwordHash) {
      await argon2
        .verify(
          '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          password,
        )
        .catch(() => false);
      throw invalidCredentialsError();
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw invalidCredentialsError();

    return { user, tokens: await this.issueTokens(user.id) };
  }

  // Rotation (§5): the presented token is looked up by hash, must be live,
  // and is revoked in the same transaction that stores its replacement —
  // a replayed old token fails the `revokedAt: null` check.
  async refresh(rawToken: string): Promise<AuthResult> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt !== null || record.expiresAt < new Date()) {
      throw invalidRefreshTokenError();
    }

    const { raw, expiresAt } = this.newRefreshToken();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: { userId: record.userId, tokenHash: hashToken(raw), expiresAt },
      }),
    ]);

    return {
      user: record.user,
      tokens: {
        accessToken: await this.signAccessToken(record.userId),
        refreshToken: raw,
        refreshExpiresAt: expiresAt,
      },
    };
  }

  async logout(rawToken: string): Promise<void> {
    // Revoking an unknown/already-revoked token is a no-op, not an error —
    // logout must always succeed from the client's perspective.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.jwtKey);
    if (typeof payload.sub !== 'string') throw new Error('Missing sub claim');
    return payload.sub;
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const { raw, expiresAt } = this.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(raw), expiresAt },
    });
    return {
      accessToken: await this.signAccessToken(userId),
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
    };
  }

  private signAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_MIN}m`)
      .sign(this.jwtKey);
  }

  private newRefreshToken(): { raw: string; expiresAt: Date } {
    return {
      raw: randomBytes(48).toString('base64url'),
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    };
  }
}
