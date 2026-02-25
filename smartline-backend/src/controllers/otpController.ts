import { Request, Response } from 'express';
import { config } from '../config/env';
import { sendOtp, verifyOtp } from '../services/beonOtpService';
import { redis, checkRedisConnection } from '../config/redis';
import { supabase } from '../config/supabase';
import { createLogger } from '../logger';

const log = createLogger('otp');

const OTP_VERIFIED_TTL = 15 * 60; // 15 minutes
const OTP_CODE_TTL = 15 * 60; // keep code for fallback verify
const OTP_COOLDOWN_TTL = 60; // 60 seconds between sends
const OTP_MAX_ATTEMPTS = 5; // max failed verify attempts
const OTP_ATTEMPT_LOCK_TTL = 900; // 15 min lockout after max attempts

// ── In-memory fallback cache (used when Redis is offline) ──
// Covers new users who don't have a DB row yet.
// Entries auto-expire via sweepMemoryCache().
interface MemoryOtpEntry {
  code?: string;
  messageId?: string;
  sentAt: number;
  verified: boolean;
  attempts: number;
}
const memCache = new Map<string, MemoryOtpEntry>();

/** Purge stale entries older than OTP_CODE_TTL */
function sweepMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memCache) {
    if (now - entry.sentAt > OTP_CODE_TTL * 1000) {
      memCache.delete(key);
    }
  }
}
// Sweep every 5 minutes
setInterval(sweepMemoryCache, 5 * 60 * 1000).unref();

// ── Redis key helpers ──
function redisKey(phone: string) {
  return `otp:verified:${phone}`;
}
function redisCodeKey(phone: string) {
  return `otp:code:${phone}`;
}
function redisCooldownKey(phone: string) {
  return `otp:cooldown:${phone}`;
}
function redisAttemptsKey(phone: string) {
  return `otp:attempts:${phone}`;
}

/** Try a Redis operation, return fallback value on failure */
async function tryRedis<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await op();
  } catch (err: any) {
    log.warn({ err: err.message }, 'Redis operation failed, using fallback');
    return fallback;
  }
}

// ─────────────────────── requestOtp ───────────────────────
export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;

  if (!config.BEON_OTP_ENABLED) {
    return res.status(400).json({ error: 'OTP service is disabled' });
  }

  const redisUp = await checkRedisConnection();

  try {
    // ── Cooldown check ──
    if (redisUp) {
      const cooldownTtl = await tryRedis(() => redis.ttl(redisCooldownKey(phone)), -2);
      if (cooldownTtl > 0) {
        log.warn({ phone }, 'OTP send blocked by cooldown');
        return res.status(429).json({
          error: 'OTP_COOLDOWN',
          retryAfter: cooldownTtl,
          message: `Please wait ${cooldownTtl} seconds before requesting another code.`,
        });
      }
    } else {
      // Memory cooldown check
      const mem = memCache.get(phone);
      if (mem) {
        const elapsed = Math.floor((Date.now() - mem.sentAt) / 1000);
        if (elapsed < OTP_COOLDOWN_TTL) {
          const retryAfter = OTP_COOLDOWN_TTL - elapsed;
          log.warn({ phone }, 'OTP send blocked by memory cooldown');
          return res.status(429).json({
            error: 'OTP_COOLDOWN',
            retryAfter,
            message: `Please wait ${retryAfter} seconds before requesting another code.`,
          });
        }
      }
    }

    const result = await sendOtp(phone);

    // ── Cache in Redis (best-effort) ──
    if (redisUp) {
      await tryRedis(async () => {
        await redis.setex(redisCooldownKey(phone), OTP_COOLDOWN_TTL, '1');
        await redis.del(redisAttemptsKey(phone));

        const codePayload: Record<string, string> = {
          status: 'sent',
          sent_at: new Date().toISOString(),
        };
        if (result.otp) codePayload.code = result.otp;
        if (result.messageId) codePayload.messageId = String(result.messageId);
        await redis.hmset(redisCodeKey(phone), codePayload as any);
        await redis.expire(redisCodeKey(phone), OTP_CODE_TTL);
      }, undefined);
    }

    // ── Always cache in memory (covers new users without DB row) ──
    memCache.set(phone, {
      code: result.otp,
      messageId: result.messageId ? String(result.messageId) : undefined,
      sentAt: Date.now(),
      verified: false,
      attempts: 0,
    });

    // ── DB: store metadata if user exists ──
    await supabase
      .from('users')
      .update({
        last_otp_code: result.otp || null,
        last_otp_message_id: result.messageId ? String(result.messageId) : null,
        last_otp_sent_at: new Date().toISOString(),
        last_otp_status: 'sent',
      })
      .eq('phone', phone);

    log.info({ phone, redisUp }, 'OTP sent successfully');
    res.json({ success: true, retryAfter: OTP_COOLDOWN_TTL });
  } catch (error: any) {
    log.error({ phone, err: error.message }, 'OTP send failed');
    res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
};

// ─────────────────────── confirmOtp ───────────────────────
export const confirmOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;

  if (!config.BEON_OTP_ENABLED) {
    return res.status(400).json({ error: 'OTP service is disabled' });
  }

  const redisUp = await checkRedisConnection();
  const mem = memCache.get(phone);

  try {
    // ── Attempt-limit check ──
    if (redisUp) {
      const attemptsKey = redisAttemptsKey(phone);
      const attempts = parseInt(await tryRedis(() => redis.get(attemptsKey), null) || '0', 10);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        log.warn({ phone, attempts }, 'OTP verify blocked - too many attempts');
        return res.status(429).json({
          error: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed attempts. Please request a new code after 15 minutes.',
        });
      }
    } else if (mem && mem.attempts >= OTP_MAX_ATTEMPTS) {
      log.warn({ phone, attempts: mem.attempts }, 'OTP verify blocked - too many attempts (memory)');
      return res.status(429).json({
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Please request a new code after 15 minutes.',
      });
    }

    // ── Load cached code / messageId (Redis → DB → memory) ──
    let cachedCode: string | null = null;
    let messageId: string | undefined;

    if (redisUp) {
      const cached = await tryRedis(() => redis.hgetall(redisCodeKey(phone)), {});
      messageId = cached?.messageId;
      cachedCode = cached?.code || null;
    }

    // DB fallback (existing users)
    if (!messageId && !cachedCode) {
      const { data: user } = await supabase
        .from('users')
        .select('last_otp_code, last_otp_message_id')
        .eq('phone', phone)
        .single();
      if (user) {
        cachedCode = user.last_otp_code || null;
        messageId = user.last_otp_message_id || undefined;
      }
    }

    // Memory fallback (new users without DB row)
    if (!messageId && !cachedCode && mem) {
      cachedCode = mem.code || null;
      messageId = mem.messageId;
    }

    // ── Verify: provider first, then cached code ──
    let valid = await verifyOtp(phone, code, messageId);

    if (!valid && cachedCode) {
      valid = cachedCode === code;
    }

    if (!valid) {
      // Track failed attempt
      if (redisUp) {
        await tryRedis(async () => {
          const attemptsKey = redisAttemptsKey(phone);
          await redis.incr(attemptsKey);
          const currentTtl = await redis.ttl(attemptsKey);
          if (currentTtl < 0) {
            await redis.expire(attemptsKey, OTP_ATTEMPT_LOCK_TTL);
          }
        }, undefined);
      }
      if (mem) {
        mem.attempts += 1;
      }
      log.warn({ phone }, 'OTP verify failed - invalid code');
      return res.status(400).json({ error: 'INVALID_CODE' });
    }

    // ── Success ──
    // Redis
    if (redisUp) {
      await tryRedis(async () => {
        await redis.del(redisAttemptsKey(phone));
        await redis.setex(redisKey(phone), OTP_VERIFIED_TTL, '1');
        await redis.hmset(redisCodeKey(phone), {
          status: 'verified',
          verified_at: new Date().toISOString(),
        } as any);
        await redis.expire(redisCodeKey(phone), OTP_CODE_TTL);
      }, undefined);
    }

    // Memory
    if (mem) {
      mem.verified = true;
      mem.attempts = 0;
    }

    // DB (existing users)
    await supabase
      .from('users')
      .update({
        last_otp_code: null,
        last_otp_status: 'verified',
        last_otp_sent_at: new Date().toISOString(),
        last_otp_message_id: messageId || null,
      })
      .eq('phone', phone);

    log.info({ phone, redisUp }, 'OTP verified successfully');
    res.json({ success: true });
  } catch (error: any) {
    log.error({ phone, err: error.message }, 'OTP verify error');
    res.status(500).json({ error: error.message || 'Failed to verify OTP' });
  }
};

// ─────────────────────── assertOtpVerified ───────────────────────
export async function assertOtpVerified(phone: string): Promise<boolean> {
  if (!config.BEON_OTP_ENABLED) {
    return true; // OTP disabled, allow through
  }

  // 1. Redis (fastest)
  const redisUp = await checkRedisConnection();
  if (redisUp) {
    const val = await tryRedis(() => redis.get(redisKey(phone)), null);
    if (val === '1') return true;
  }

  // 2. Memory cache (covers new users without DB row)
  const mem = memCache.get(phone);
  if (mem && mem.verified) {
    const elapsed = Date.now() - mem.sentAt;
    if (elapsed < OTP_VERIFIED_TTL * 1000) return true;
  }

  // 3. DB (existing users)
  const { data: user } = await supabase
    .from('users')
    .select('last_otp_status, last_otp_sent_at')
    .eq('phone', phone)
    .single();

  if (!user || user.last_otp_status !== 'verified' || !user.last_otp_sent_at) {
    return false;
  }

  const verifiedAt = new Date(user.last_otp_sent_at).getTime();
  return (Date.now() - verifiedAt) < OTP_VERIFIED_TTL * 1000;
}
