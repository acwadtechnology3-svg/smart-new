
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import { socketService } from './socketService';

// Smart Update Configuration
const UPDATE_CONFIG = {
    idle: {
        timeInterval: 30000,    // 30s
        distanceInterval: 100   // 100m
    },
    active: {
        timeInterval: 5000,     // 5s
        distanceInterval: 20    // 20m
    },
    nearDestination: {
        timeInterval: 3000,     // 3s
        distanceInterval: 10    // 10m
    },
    lowBattery: {
        timeInterval: 60000,    // 1 min
        distanceInterval: 200   // 200m
    }
};

// High-demand urban areas (Cairo example - adjust for your country)
const URBAN_ZONES = [
    { name: 'Downtown Cairo', lat: 30.0444, lng: 31.2357, radius: 5 },
    { name: 'Nasr City', lat: 30.0561, lng: 31.3558, radius: 4 },
    { name: 'Zamalek', lat: 30.0626, lng: 31.2197, radius: 3 },
    // Add more zones for your country
];

export type TrackingMode = 'idle' | 'active' | 'nearDestination';

interface LocationUpdate {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    timestamp: string;
}

export class LocationTrackingService {
    private subscription: Location.LocationSubscription | null = null;
    private mode: TrackingMode = 'idle';
    private isTracking = false;
    private batteryLevel = 1.0;
    private batterySubscription: Battery.Subscription | null = null;
    private locationBuffer: LocationUpdate[] = [];
    private lastSentLocation: LocationUpdate | null = null;
    private flushInterval: NodeJS.Timeout | null = null;

    /**
     * Start tracking with smart intervals
     */
    async startTracking(mode: TrackingMode = 'idle') {
        if (this.isTracking) {
            console.log('[LocationTracking] Already tracking, updating mode...');
            this.mode = mode;
            await this.restartWithNewMode();
            return;
        }

        console.log(`[LocationTracking] Starting in ${mode} mode`);
        this.isTracking = true;
        this.mode = mode;

        // Monitor battery level
        await this.setupBatteryMonitoring();

        // Start location tracking
        await this.startLocationUpdates();

        // Setup periodic buffer flush (for batch updates)
        this.flushInterval = setInterval(() => {
            this.flushLocationBuffer();
        }, 15000); // Flush every 15s
    }

    /**
     * Stop all tracking
     */
    async stopTracking() {
        console.log('[LocationTracking] Stopping...');
        this.isTracking = false;

        if (this.subscription) {
            this.subscription.remove();
            this.subscription = null;
        }

        if (this.batterySubscription) {
            this.batterySubscription.remove();
            this.batterySubscription = null;
        }

        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        // Send any remaining buffered locations
        await this.flushLocationBuffer();
    }

    /**
     * Update tracking mode (idle/active/nearDestination)
     */
    async setMode(mode: TrackingMode) {
        if (this.mode === mode) return;

        console.log(`[LocationTracking] Switching from ${this.mode} to ${mode}`);
        this.mode = mode;

        if (this.isTracking) {
            await this.restartWithNewMode();
        }
    }

    /**
     * Get current tracking configuration based on mode and battery
     */
    private getTrackingConfig() {
        // Battery optimization: use low-power mode if battery < 20%
        if (this.batteryLevel < 0.2) {
            console.log('[LocationTracking] Low battery mode enabled');
            return UPDATE_CONFIG.lowBattery;
        }

        return UPDATE_CONFIG[this.mode];
    }

    /**
     * Check if location is in high-demand urban zone
     */
    private isInUrbanZone(lat: number, lng: number): boolean {
        // Check if within any urban zone using Haversine distance
        for (const zone of URBAN_ZONES) {
            const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
            if (distance <= zone.radius) {
                return true;
            }
        }
        return false;
    }

    /**
     * Setup battery monitoring
     */
    private async setupBatteryMonitoring() {
        try {
            // Get initial battery level
            this.batteryLevel = await Battery.getBatteryLevelAsync();

            // Subscribe to battery updates
            this.batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
                const oldLevel = this.batteryLevel;
                this.batteryLevel = batteryLevel;

                // If battery crossed 20% threshold, restart tracking with new config
                // Case 1: Was >= 20%, now < 20% (Optimise)
                // Case 2: Was < 20%, now >= 20% (Restore)
                const crossedDown = oldLevel >= 0.2 && batteryLevel < 0.2;
                const crossedUp = oldLevel < 0.2 && batteryLevel >= 0.2;

                if (crossedDown || crossedUp) {
                    console.log(`[LocationTracking] Battery level changed: ${(batteryLevel * 100).toFixed(0)}%`);
                    this.restartWithNewMode();
                }
            });
        } catch (error) {
            //   console.error('[LocationTracking] Battery monitoring error (simulated/unavailable):', error);
            // Suppress error in simulator or just log
        }
    }

    /**
     * Start location updates with current config
     */
    private async startLocationUpdates() {
        try {
            const config = this.getTrackingConfig();

            console.log('[LocationTracking] Current Config:', config);

            this.subscription = await Location.watchPositionAsync(
                {
                    accuracy: this.batteryLevel < 0.2
                        ? Location.Accuracy.Balanced
                        : Location.Accuracy.High,
                    timeInterval: config.timeInterval,
                    distanceInterval: config.distanceInterval,
                },
                (location) => this.handleLocationUpdate(location)
            );
        } catch (error) {
            console.error('[LocationTracking] Failed to start location updates:', error);
        }
    }

    /**
     * Restart tracking with new configuration
     */
    private async restartWithNewMode() {
        if (this.subscription) {
            this.subscription.remove();
            this.subscription = null;
        }
        await this.startLocationUpdates();
    }

    /**
     * Handle incoming location update
     */
    private handleLocationUpdate(location: Location.LocationObject) {
        const update: LocationUpdate = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            heading: location.coords.heading ?? undefined,
            speed: location.coords.speed ?? undefined,
            accuracy: location.coords.accuracy ?? undefined,
            timestamp: new Date().toISOString(),
        };

        // Check if we should send immediately or buffer
        const shouldSendImmediately = this.shouldSendImmediately(update);

        if (shouldSendImmediately) {
            // Send via WebSocket immediately
            this.sendLocationUpdate(update);
        } else {
            // Buffer for batch sending
            this.locationBuffer.push(update);

            // If buffer is full, flush it
            if (this.locationBuffer.length >= 5) {
                this.flushLocationBuffer();
            }
        }

        this.lastSentLocation = update;
    }

    /**
     * Determine if location should be sent immediately
     */
    private shouldSendImmediately(update: LocationUpdate): boolean {
        // Always send immediately in active/nearDestination modes
        if (this.mode === 'active' || this.mode === 'nearDestination') {
            return true;
        }

        // Send immediately if in urban zone
        if (this.isInUrbanZone(update.lat, update.lng)) {
            return true;
        }

        // Send immediately if moved significantly since last update (> 100m)
        if (this.lastSentLocation) {
            const distance = this.calculateDistance(
                update.lat,
                update.lng,
                this.lastSentLocation.lat,
                this.lastSentLocation.lng
            );

            // If moved > 0.1km (100m), send immediately
            if (distance > 0.1) {
                return true;
            }
        }

        // Otherwise (idle, rural areas, small movement), buffer it
        return false;
    }

    /**
     * Send single location update via WebSocket
     */
    private sendLocationUpdate(update: LocationUpdate) {
        // Use socket service to emit
        if (!socketService.isConnected()) {
            // Attempt connect or queue? For now just log
            //  console.log('[LocationTracking] Socket disconnected, cannot send');
            return;
        }
        socketService.emit('location:update', update);
    }

    /**
     * Flush buffered locations (batch update)
     */
    private async flushLocationBuffer() {
        if (this.locationBuffer.length === 0) return;

        if (!socketService.isConnected()) return;

        console.log(`[LocationTracking] Flushing ${this.locationBuffer.length} buffered locations`);

        // Send batch update
        socketService.emit('location:batch-update', {
            locations: this.locationBuffer,
        });

        // Clear buffer
        this.locationBuffer = [];
    }

    /**
     * Calculate distance between two coordinates (km)
     */
    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLng = this.deg2rad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) *
            Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}

// Export singleton
export const locationTracker = new LocationTrackingService();
