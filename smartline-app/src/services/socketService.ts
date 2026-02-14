
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

class SocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isConnecting = false;

    /**
     * Connect to WebSocket server
     */
    async connect() {
        if (this.socket?.connected || this.isConnecting) {
            console.log('[Socket] Already connected or connecting');
            return;
        }

        this.isConnecting = true;

        try {
            const token = await this.getAuthToken();
            if (!token) {
                console.error('[Socket] No auth token found');
                this.isConnecting = false;
                return;
            }

            // Important: adjust URL to use base URL without /api prefix if socket.io is mounted at root
            // Or just use API_URL. usually API_URL is http://.../api
            // Socket.io standard path is /socket.io
            // If server is http://localhost:3000/api, we want http://localhost:3000
            const socketUrl = API_URL.replace(/\/api\/?$/, '');

            console.log('[Socket] Connecting to:', socketUrl);

            this.socket = io(socketUrl, {
                auth: { token },
                transports: ['polling', 'websocket'],
                upgrade: true,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: this.maxReconnectAttempts,
                timeout: 10000,
            });

            this.setupEventHandlers();
            this.isConnecting = false;
        } catch (error) {
            console.error('[Socket] Connection error:', error);
            this.isConnecting = false;
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.socket) {
            console.log('[Socket] Disconnecting...');
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Emit event to server
     */
    emit(event: string, data?: any) {
        if (!this.socket?.connected) {
            console.warn('[Socket] Not connected, buffering event:', event);
            // Could implement a queue here for offline support
            return false;
        }

        this.socket.emit(event, data);
        return true;
    }

    /**
     * Listen for event from server
     */
    on(event: string, callback: (data: any) => void) {
        if (!this.socket) {
            // Queue listener if socket not init? Or just warn.
            // Better: Initialize structure even if socket null, but standard pattern is warn.
            console.warn('[Socket] Socket not initialized when adding listener for:', event);
            // However, if we call connect() then immediately on(), socket might be null async.
            // But connect() is async.
            return;
        }

        this.socket.on(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event: string, callback?: (data: any) => void) {
        if (!this.socket) return;

        if (callback) {
            this.socket.off(event, callback);
        } else {
            this.socket.off(event);
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('[Socket] ✅ Connected');
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[Socket] ❌ Disconnected:', reason);

            // Auto-reconnect on certain disconnect reasons
            if (reason === 'io server disconnect') {
                // Server disconnected us, try to reconnect
                setTimeout(() => this.connect(), 2000);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('[Socket] Max reconnection attempts reached');
                this.disconnect();
            }
        });

        this.socket.on('error', (error) => {
            console.error('[Socket] Error:', error);
        });

        // Handle location update acknowledgment
        this.socket.on('location:updated', (data) => {
            // console.log('[Socket] Location update acknowledged:', data);
        });

        // Handle batch update acknowledgment
        this.socket.on('location:batch-updated', (data) => {
            console.log('[Socket] Batch update acknowledged:', data.count, 'locations');
        });
    }

    /**
     * Get auth token from storage
     */
    private async getAuthToken(): Promise<string | null> {
        try {
            const session = await AsyncStorage.getItem('userSession');
            if (!session) return null;

            const { token } = JSON.parse(session);
            return token || null;
        } catch (error) {
            console.error('[Socket] Failed to get auth token:', error);
            return null;
        }
    }
}

// Export singleton
export const socketService = new SocketService();
