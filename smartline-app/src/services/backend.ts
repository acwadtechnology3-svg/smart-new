import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

type RequestOptions = RequestInit & { auth?: boolean };

async function getToken() {
  const session = await AsyncStorage.getItem('userSession');
  if (!session) return null;
  try {
    const { token } = JSON.parse(session);
    return token as string | undefined;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth !== false;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  } as Record<string, string>;

  if (auth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      // No token available — user is signed out. Fail fast to avoid
      // noisy MISSING_TOKEN errors from the backend during logout.
      const error: any = new Error('Not authenticated');
      error.code = 'AUTH_SIGNED_OUT';
      error.status = 401;
      throw error;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error || 'Request failed';
      const errorMsgString = typeof message === 'object' ? JSON.stringify(message) : String(message);
      const error: any = new Error(errorMsgString);
      error.status = response.status;
      throw error;
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}
