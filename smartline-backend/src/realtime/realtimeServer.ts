import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { supabase } from '../config/supabase';
import { registerDriver, unregisterDriver } from './broadcaster';

type Role = 'customer' | 'driver' | 'admin';

type SubscriptionType =
  | 'driver:trip-requests'
  | 'driver:offer-updates'
  | 'driver:location'
  | 'trip:offers'
  | 'trip:status'
  | 'trip:messages'
  | 'support:messages';

type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'subscribe'; subscriptionId: string; channel: SubscriptionType; tripId?: string; driverId?: string; ticketId?: string }
  | { type: 'unsubscribe'; subscriptionId: string }
  | { type: 'ping' };

type ServerMessage =
  | { type: 'authed'; userId: string; role: Role }
  | { type: 'subscribed'; subscriptionId: string }
  | { type: 'unsubscribed'; subscriptionId: string }
  | { type: 'event'; subscriptionId: string; payload: any }
  | { type: 'error'; message: string; subscriptionId?: string };

interface ClientContext {
  ws: WebSocket;
  userId: string | null;
  role: Role | null;
  subscriptions: Map<string, any>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value?: string): boolean {
  return !!value && UUID_REGEX.test(value);
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(message));
}

async function getTripParticipants(tripId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('customer_id, driver_id')
    .eq('id', tripId)
    .single();

  if (error || !data) {
    throw new Error('Trip not found');
  }

  return data as { customer_id: string; driver_id: string | null };
}

async function assertTripParticipant(userId: string, tripId: string) {
  const trip = await getTripParticipants(tripId);
  if (trip.customer_id !== userId && trip.driver_id !== userId) {
    throw new Error('Not authorized for this trip');
  }
  return trip;
}

export function startRealtimeServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const ctx: ClientContext = {
      ws,
      userId: null,
      role: null,
      subscriptions: new Map(),
    };

    ws.on('message', async (raw) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON payload' });
        return;
      }

      if (message.type === 'ping') {
        send(ws, { type: 'event', subscriptionId: 'ping', payload: { pong: true } });
        return;
      }

      if (message.type === 'auth') {
        try {
          const decoded = jwt.verify(message.token, config.JWT_SECRET) as {
            id: string;
            role: Role;
          };
          ctx.userId = decoded.id;
          ctx.role = decoded.role;
          send(ws, { type: 'authed', userId: decoded.id, role: decoded.role });
        } catch {
          send(ws, { type: 'error', message: 'Authentication failed' });
          ws.close();
        }
        return;
      }

      if (!ctx.userId || !ctx.role) {
        send(ws, { type: 'error', message: 'Not authenticated' });
        return;
      }

      if (message.type === 'unsubscribe') {
        const sub = ctx.subscriptions.get(message.subscriptionId);
        if (sub) {
          supabase.removeChannel(sub.channel);
          ctx.subscriptions.delete(message.subscriptionId);
          // Unregister from broadcaster
          if (ctx.role === 'driver') {
            unregisterDriver(ctx.userId, message.subscriptionId);
          }
        }
        send(ws, { type: 'unsubscribed', subscriptionId: message.subscriptionId });
        return;
      }

      if (message.type !== 'subscribe') return;

      const { subscriptionId, channel, tripId, ticketId } = message;
      if (!subscriptionId) {
        send(ws, { type: 'error', message: 'subscriptionId is required' });
        return;
      }

      if (ctx.subscriptions.has(subscriptionId)) {
        send(ws, { type: 'error', message: 'subscriptionId already in use', subscriptionId });
        return;
      }

      try {
        let supaChannel: any;

        switch (channel) {
          case 'driver:trip-requests': {
            if (ctx.role !== 'driver') throw new Error('Drivers only');
            console.log(`[Realtime] Driver ${ctx.userId} subscribing to trip-requests`);

            // Register driver for direct broadcasts
            registerDriver(ctx.userId, ws, subscriptionId);

            // Also keep Supabase realtime as fallback
            supaChannel = supabase
              .channel(`driver-inbox-${ctx.userId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'trips', filter: 'status=eq.requested' },
                (payload) => {
                  console.log(`[Realtime] New trip created via Supabase, notifying driver ${ctx.userId}:`, payload.new);
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          case 'driver:offer-updates': {
            if (ctx.role !== 'driver') throw new Error('Drivers only');

            // Register for direct broadcasts (fix for manual notifications)
            registerDriver(ctx.userId, ws, subscriptionId);

            supaChannel = supabase
              .channel(`driver-offers-${ctx.userId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'trip_offers', filter: `driver_id=eq.${ctx.userId}` },
                (payload) => {
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          case 'driver:location': {
            if (!isUuid(tripId)) throw new Error('tripId is required');
            if (!isUuid(message.driverId)) throw new Error('driverId is required');
            await assertTripParticipant(ctx.userId, tripId!);
            supaChannel = supabase
              .channel(`driver-location-${message.driverId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${message.driverId}` },
                (payload) => {
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          case 'trip:offers': {
            if (!isUuid(tripId)) throw new Error('tripId is required');
            await assertTripParticipant(ctx.userId, tripId!);
            supaChannel = supabase
              .channel(`trip-offers-${tripId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'trip_offers', filter: `trip_id=eq.${tripId}` },
                async (payload) => {
                  if (payload?.new?.driver_id) {
                    const { data: driver } = await supabase
                      .from('drivers')
                      .select('id, vehicle_model, vehicle_plate, rating, profile_photo_url, users!inner(full_name)')
                      .eq('id', payload.new.driver_id)
                      .single();
                    payload.new.driver = driver || null;
                  }
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          case 'trip:status': {
            if (!isUuid(tripId)) throw new Error('tripId is required');
            await assertTripParticipant(ctx.userId, tripId!);
            supaChannel = supabase
              .channel(`trip-status-${tripId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
                (payload) => {
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          case 'trip:messages': {
            if (!isUuid(tripId)) throw new Error('tripId is required');
            await assertTripParticipant(ctx.userId, tripId!);
            supaChannel = supabase
              .channel(`trip-messages-${tripId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` },
                (payload) => {
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          case 'support:messages': {
            if (!isUuid(ticketId)) throw new Error('ticketId is required');

            // Check authorization
            if (ctx.role !== 'admin') {
              const { data: ticket } = await supabase
                .from('support_tickets')
                .select('user_id')
                .eq('id', ticketId)
                .single();

              if (!ticket || ticket.user_id !== ctx.userId) {
                throw new Error('Not authorized for this ticket');
              }
            }

            supaChannel = supabase
              .channel(`support-messages-${ticketId}-${subscriptionId}`)
              .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
                (payload) => {
                  send(ws, { type: 'event', subscriptionId, payload });
                }
              );
            break;
          }
          default:
            throw new Error('Unsupported channel');
        }

        await supaChannel.subscribe();
        ctx.subscriptions.set(subscriptionId, { channel: supaChannel });
        send(ws, { type: 'subscribed', subscriptionId });
      } catch (error: any) {
        send(ws, { type: 'error', message: error.message || 'Subscription failed', subscriptionId });
      }
    });

    ws.on('close', () => {
      // Unregister driver from broadcaster on disconnect
      if (ctx.role === 'driver' && ctx.userId) {
        for (const subId of ctx.subscriptions.keys()) {
          unregisterDriver(ctx.userId, subId);
        }
      }

      // Clean up Supabase channels
      for (const sub of ctx.subscriptions.values()) {
        supabase.removeChannel(sub.channel);
      }
      ctx.subscriptions.clear();
    });
  });

  console.log('✅ Realtime WebSocket server started at /ws');
}
