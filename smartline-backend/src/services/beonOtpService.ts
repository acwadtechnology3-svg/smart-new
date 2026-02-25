import { config } from '../config/env';
import { createLogger } from '../logger';

const log = createLogger('beon-otp');

const BASE_URL = config.BEON_OTP_BASE_URL;
const TOKEN = config.BEON_OTP_TOKEN;
const LANG = config.BEON_OTP_LANG;
const LENGTH = config.BEON_OTP_LENGTH;

export async function sendOtp(phone: string): Promise<{ success: boolean; message?: string; otp?: string; messageId?: string | number }> {
  const url = `${BASE_URL}/messages/otp`;

  const formData = new FormData();
  formData.append('phoneNumber', phone);
  formData.append('name', 'smart line');
  formData.append('type', 'sms');
  formData.append('otp_length', `${LENGTH}`);
  formData.append('reference', `${Date.now()}`);

  log.info({ phone, url }, 'Sending OTP request');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'beon-token': TOKEN || '',
      },
      body: formData as any,
    });
  } catch (fetchErr: any) {
    log.error({ phone, err: fetchErr.message }, 'BEON API unreachable (network/DNS)');
    throw new Error(`BEON API unreachable: ${fetchErr.message}`);
  }

  const text = await res.text();
  log.debug({ phone, status: res.status }, 'BEON sendOtp response received');

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    log.error({ phone, status: res.status }, 'BEON API returned non-JSON response');
    throw new Error(`BEON API returned non-JSON (status ${res.status})`);
  }

  if (!res.ok) {
    log.error({ phone, status: res.status }, 'BEON sendOtp failed');
    throw new Error(data.message || `BEON API error (status ${res.status})`);
  }

  return { success: true, message: data.message, otp: data?.data?.otp, messageId: data?.data?.message_id };
}

export async function verifyOtp(phone: string, code: string, messageId?: string | number): Promise<boolean> {
  const primaryUrl = `${BASE_URL}/otp/verify`;
  const fallbackUrl = `${BASE_URL}/messages/otp/verify`; // try legacy/alt path if primary 404s

  const formData = new FormData();
  formData.append('phoneNumber', phone);
  formData.append('otp', code);
  if (messageId) {
    formData.append('message_id', `${messageId}`);
  }

  const attempt = async (url: string) => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'beon-token': TOKEN || '',
        },
        body: formData as any,
      });
    } catch (fetchErr: any) {
      log.error({ phone, url, err: fetchErr.message }, 'BEON verify fetch error');
      return { ok: false, status: 0, data: null, text: '' };
    }

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      log.error({ phone, url, status: res.status, body: text?.slice(0, 200) }, 'BEON verify non-JSON response');
      return { ok: false, status: res.status, data: null, text };
    }

    return { ok: res.ok, status: res.status, data, text };
  };

  // Try primary endpoint first
  const primary = await attempt(primaryUrl);
  if (primary.ok && (primary.data?.status === 200 || primary.data?.success === true)) {
    return true;
  }

  // If primary failed with 404/non-JSON, try fallback path once
  if (!primary.ok && primary.status === 404) {
    const fallback = await attempt(fallbackUrl);
    if (fallback.ok && (fallback.data?.status === 200 || fallback.data?.success === true)) {
      log.info({ phone, url: fallbackUrl }, 'BEON verify succeeded via fallback endpoint');
      return true;
    }
    if (!fallback.ok) {
      log.warn({ phone, url: fallbackUrl, status: fallback.status }, 'BEON verify fallback failed');
    }
  } else if (!primary.ok) {
    log.warn({ phone, url: primaryUrl, status: primary.status }, 'BEON verify failed');
  }

  return false;
}
