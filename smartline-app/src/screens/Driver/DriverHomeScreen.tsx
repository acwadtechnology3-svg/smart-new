import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Image, Dimensions, Animated, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { apiRequest } from '../../services/backend';
import { socketService } from '../../services/socketService';
import { locationTracker, TrackingMode } from '../../services/LocationTrackingService';
import { Menu, Shield, CircleDollarSign, Navigation, Siren } from 'lucide-react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Constants from 'expo-constants';
import DriverSideMenu from '../../components/DriverSideMenu';
import TripRequestModal from '../../components/TripRequestModal';
import SafetyModal from '../../components/SafetyModal';
import { useLanguage } from '../../context/LanguageContext';
import { registerForPushNotificationsAsync, updateBackendToken } from '../../utils/notifications';
import { CachedImage } from '../../components/CachedImage';
import PopupNotification from '../../components/PopupNotification';
import SurgeMapLayer from '../../components/SurgeMapLayer';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';

const { width, height } = Dimensions.get('window');

export default function DriverHomeScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t, isRTL } = useLanguage();
    const { colors, spacing, radius, shadow, isDark } = useTheme();

    const [isOnline, setIsOnline] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [driverProfile, setDriverProfile] = useState<any>(null);
    const [isSideMenuVisible, setSideMenuVisible] = useState(false);
    const mapRef = useRef<MapView>(null);
    const sideMenuAnim = useRef(new Animated.Value(-width * 0.75)).current; // Added this line
    const [dailyEarnings, setDailyEarnings] = useState(0);
    const [walletBalance, setWalletBalance] = useState(0);
    const [incomingTrip, setIncomingTrip] = useState<any>(null);
    // Track ignored IDs AND their price. If price changes, show again.
    const [ignoredTrips, setIgnoredTrips] = useState<Map<string, number>>(new Map());
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const [safetyModalVisible, setSafetyModalVisible] = useState(false);
    const [trackingMode, setTrackingMode] = useState<TrackingMode>('idle');

    // Prevent duplicate handling of accepted trips
    const processedAcceptedTrips = useRef(new Set<string>()); // Added this line

    // Animation for "Finding Trips" pulse
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        console.log('[Mapbox] 🗺️ Map View Mounted - Consuming Raster Tiles');

        registerForPushNotificationsAsync().then(token => {
            if (token) updateBackendToken(token);
        });

        // Connect to WebSocket
        socketService.connect();

        return () => {
            locationTracker.stopTracking();
            socketService.disconnect();
        };
    }, []);

    useEffect(() => {
        // Start pulse animation when online
        if (isOnline) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isOnline]);

    // Default to Cairo if location not yet found
    const DEFAULT_REGION = {
        latitude: 30.0444,
        longitude: 31.2357,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

    const checkActiveTrip = async () => {
        try {
            // Check history for any trip that is active
            const history = await apiRequest<{ trips: any[] }>('/trips/driver/history');
            const activeTrip = history.trips?.find((t: any) =>
                ['accepted', 'arrived', 'started'].includes(t.status)
            );

            if (activeTrip) {
                // If it is a travel request (scheduled/intercity), do NOT auto-navigate.
                // The driver can view it in history or the new sidebar item.
                if (activeTrip.is_travel_request) {
                    console.log("Active Travel Request found, staying on Home:", activeTrip.id);
                    setTrackingMode('idle');
                } else {
                    console.log("Restoring active trip:", activeTrip.id);
                    navigation.navigate('DriverActiveTrip', { tripId: activeTrip.id });
                    setIsOnline(true);
                    if (activeTrip.status === 'started') {
                        setTrackingMode('active');
                    } else {
                        setTrackingMode('nearDestination');
                    }
                }
            }
        } catch (e) {
            console.log("Error checking active trip", e);
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        (async () => {
            // 1. Get Permissions
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            // 2. Fast Location Strategy
            try {
                // Try last known location first (Instant)
                const lastKnown = await Location.getLastKnownPositionAsync({});
                if (lastKnown) {
                    setLocation(lastKnown);
                    // Animate immediately (with small delay to ensure ref is ready)
                    setTimeout(() => {
                        mapRef.current?.animateToRegion({
                            latitude: lastKnown.coords.latitude,
                            longitude: lastKnown.coords.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }, 500);
                    }, 100);
                }

                // Fetch precise location in background
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(curr => {
                    setLocation(curr);
                    mapRef.current?.animateToRegion({
                        latitude: curr.coords.latitude,
                        longitude: curr.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }, 1000);
                }).catch(e => console.log("Precise location error:", e));

            } catch (e) {
                console.log("Location error:", e);
            }

            // 3. Fetch Driver Profile & Finances
            const sessionData = await AsyncStorage.getItem('userSession');
            if (sessionData) {
                const { user } = JSON.parse(sessionData);
                if (!user?.id) return;

                const summary = await apiRequest<{ driver: any; balance: number; dailyEarnings: number }>('/drivers/summary');
                if (summary.driver?.profile_photo_url) {
                    // summary.driver.profile_photo_url = `${summary.driver.profile_photo_url}?t=${new Date().getTime()}`;
                }
                setDriverProfile(summary.driver);
                setWalletBalance(summary.balance || 0);
                setDailyEarnings(summary.dailyEarnings || 0);

                // Check for active trip to restore state
                checkActiveTrip();
            }
        })();
    }, []);

    // Update tracking mode when it changes
    useEffect(() => {
        if (isOnline) {
            locationTracker.setMode(trackingMode);
        }
    }, [trackingMode, isOnline]);

    // Polling for available trips (Backup for Realtime)
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        if (isOnline && location && driverProfile) {
            pollInterval = setInterval(async () => {
                try {
                    // If we have an incoming trip, verify it is still valid
                    if (incomingTrip) {
                        try {
                            const { trip } = await apiRequest<{ trip: any }>(`/trips/${incomingTrip.id}?t=${Date.now()}`);
                            if (trip.status !== 'requested') {
                                console.log(`[DriverPolling] Trip ${incomingTrip.id} is no longer requested (Status: ${trip.status}). Removing.`);
                                Alert.alert("Trip Unavailable", "The trip has been cancelled or taken.");
                                setIncomingTrip(null);
                            }
                        } catch (e: any) {
                            // Only clear if explicitly not found or bad request
                            if (e.status === 404 || e.status === 400) {
                                setIncomingTrip(null);
                            }
                            // Network/Server errors: keep showing trip and retry next poll
                        }
                        return; // Skip searching
                    }

                    // Otherwise, search for new trips
                    const { trips } = await apiRequest<{ trips: any[] }>(`/trips/requested?t=${Date.now()}`);

                    if (trips && trips.length > 0) {
                        const validTrips = trips.filter(trip => {
                            // Check if ignored
                            if (ignoredTrips.has(trip.id)) {
                                const ignoredPrice = ignoredTrips.get(trip.id);
                                // If price changed (increased), show it again!
                                if (trip.price === ignoredPrice) {
                                    return false;
                                }
                            }
                            if (!trip.pickup_lat) return false;

                            const dist = getDistanceFromLatLonInKm(
                                location.coords.latitude, location.coords.longitude,
                                trip.pickup_lat, trip.pickup_lng
                            );
                            return dist <= 5;
                        });

                        if (validTrips.length > 0) {
                            validTrips.sort((a, b) => {
                                const distA = getDistanceFromLatLonInKm(location.coords.latitude, location.coords.longitude, a.pickup_lat, a.pickup_lng);
                                const distB = getDistanceFromLatLonInKm(location.coords.latitude, location.coords.longitude, b.pickup_lat, b.pickup_lng);
                                return distA - distB;
                            });

                            const trip = validTrips[0];
                            console.log(`[DriverPolling] Found trip via poll: ${trip.id}`);
                            setIncomingTrip(trip);
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }, 4000);
        }

        return () => clearInterval(pollInterval);
    }, [isOnline, location, incomingTrip, ignoredTrips, driverProfile]);

    const handleDeclineTrip = () => {
        if (incomingTrip) {
            setIgnoredTrips(prev => {
                const newMap = new Map(prev);
                newMap.set(incomingTrip.id, incomingTrip.price);
                return newMap;
            });
        }
        setIncomingTrip(null);
    };

    useFocusEffect(
        React.useCallback(() => {
            if (route.params?.autoOnline) {
                console.log("Auto-online triggered from navigation params");
                setIsOnline(true);
                navigation.setParams({ autoOnline: undefined });
            }
            checkActiveTrip();
        }, [route.params])
    );

    // Toggle Online Status
    const toggleOnline = async () => {
        // BLOCKING LOGIC: Check Debt
        if (!isOnline && walletBalance < -100) {
            Alert.alert(
                t('accessBlocked'),
                t('balanceLow'),
                [
                    { text: t('cancel'), style: "cancel" },
                    { text: t('goToWallet'), onPress: () => navigation.navigate('DriverWallet') }
                ]
            );
            return;
        }

        const newStatus = !isOnline;
        // ... (rest of logic)
        try {
            const sessionData = await AsyncStorage.getItem('userSession');
            if (!sessionData) {
                Alert.alert(t('error'), "No user found. Please re-login.");
                return;
            }
            const { user } = JSON.parse(sessionData); // Re-fetch user to be safe

            // Ensure we have location before going online
            let currentLoc = location;
            // ... (permission logic same as before)
            if (newStatus && !currentLoc) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    currentLoc = await Location.getCurrentPositionAsync({});
                    setLocation(currentLoc);
                } else {
                    Alert.alert(t('permissionDenied'), t('locationPermissionRequired'));
                    return;
                }
            }

            setIsOnline(newStatus);

            await apiRequest('/location/status', {
                method: 'POST',
                body: JSON.stringify({
                    isOnline: newStatus,
                    lat: currentLoc?.coords.latitude,
                    lng: currentLoc?.coords.longitude
                })
            });

            if (newStatus) {
                await locationTracker.startTracking('idle');
                const sub = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
                    (loc) => setLocation(loc)
                );
                setLocationSubscription(sub);
            } else {
                await locationTracker.stopTracking();
                if (locationSubscription) {
                    locationSubscription.remove();
                    setLocationSubscription(null);
                }
            }
        } catch (error: any) {
            console.error("Error updating status:", error);
            Alert.alert("Go Online Failed", error.message);
            setIsOnline(isOnline);
        }
    };

    // WebSocket Trip Listening
    useEffect(() => {
        if (!isOnline || !driverProfile) return;

        console.log("Setting up WebSocket trip listeners...");

        // Listen for new trip requests
        const handleNewTrip = (trip: any) => {
            console.log(`[WebSocket] 🆕 NEW TRIP ARRIVED!`, trip.id);

            if (trip.status !== 'requested') {
                return;
            }

            // Check if ignored
            if (ignoredTrips.has(trip.id)) {
                if (trip.price === ignoredTrips.get(trip.id)) return;
            }

            // Check distance
            if (location && trip.pickup_lat) {
                const dist = getDistanceFromLatLonInKm(
                    location.coords.latitude, location.coords.longitude,
                    trip.pickup_lat, trip.pickup_lng
                );
                if (dist <= 5) setIncomingTrip(trip);
            } else {
                setIncomingTrip(trip); // Fallback if no location
            }
        };

        // Listen for offer updates
        const handleOfferUpdate = (data: any) => {
            if (data.event === 'TRIP_ACCEPTED' && data.trip) {
                const trip = data.trip;
                console.log(`[WebSocket] 🚀 TRIP ACCEPTED! Navigating to ${trip.id}`);

                if (processedAcceptedTrips.current.has(trip.id)) return;
                processedAcceptedTrips.current.add(trip.id);

                if (trip.is_travel_request) {
                    Alert.alert("🎉 Offer Accepted!", "Find this trip in History.", [{ text: "OK" }]);
                } else {
                    setTrackingMode('active');
                    navigation.navigate('DriverActiveTrip', { tripId: trip.id, initialTripData: trip });
                }
            }
        };

        socketService.on('trip:new', handleNewTrip);
        socketService.on('trip:offer-update', handleOfferUpdate);

        return () => {
            socketService.off('trip:new', handleNewTrip);
            socketService.off('trip:offer-update', handleOfferUpdate);
        };
    }, [isOnline, driverProfile, location, ignoredTrips]);

    const handleAcceptTrip = async (tripId: string) => {
        if (!driverProfile || !incomingTrip) return;
        submitOffer(tripId, parseFloat(incomingTrip.price));
    };

    const handleBidTrip = async (tripId: string, amount: number) => {
        submitOffer(tripId, amount);
    };

    const submitOffer = async (tripId: string, amount: number) => {
        try {
            await apiRequest('/trip-offers', {
                method: 'POST',
                body: JSON.stringify({ tripId, offerPrice: amount })
            });

            console.log("Offer Inserted Successfully:", tripId, amount);

            // Ignore this trip so it doesn't reappear in polling
            setIgnoredTrips(prev => {
                const newMap = new Map(prev);
                newMap.set(tripId, amount); // Store our bid as the 'seen' price
                return newMap;
            });

            Alert.alert("Offer Sent", "Waiting for customer to accept...");
            setIncomingTrip(null);
        } catch (err: any) {
            Alert.alert(t('error'), err.message);
        }
    };

    // Haversine Formula
    function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);  // deg2rad below
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d;
    }

    function deg2rad(deg: number) {
        return deg * (Math.PI / 180)
    }

    useEffect(() => {
        return () => {
            if (locationSubscription) locationSubscription.remove();
        };
    }, [locationSubscription]);

    const triggerSOSAlert = async () => {
        if (!location) {
            Alert.alert(t('error'), t('locationPermissionRequired'));
            return;
        }

        try {
            await apiRequest('/sos/create', {
                method: 'POST',
                body: JSON.stringify({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    notes: "High priority SOS alert triggered from driver app"
                })
            });

            Alert.alert(
                t('sosSent'),
                t('sosMessage'),
                [{ text: t('ok') }]
            );
        } catch (error: any) {
            console.error("SOS Error:", error);
            Alert.alert(t('error'), "Failed to send SOS alert. Please try calling 122 directly.");
        }
    };

    const handleSOS = () => {
        setSafetyModalVisible(true);
    };

    const handleCallEmergency = () => {
        Alert.alert(
            "Call Emergency Services?",
            "This will dial 122 (Egyptian Emergency Services)",
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: "Call Now",
                    onPress: () => {
                        Alert.alert("Emergency", "Calling 122...");
                    }
                }
            ]
        );
    };

    const handleSendSOS = () => {
        Alert.alert(
            "Emergency SOS",
            "This will send your live location to our dispatch team. Only use this in real emergencies.",
            [
                { text: t('cancel'), style: "cancel" },
                { text: "SEND SOS", style: "destructive", onPress: triggerSOSAlert }
            ]
        );
    };

    const handleShareLocation = () => {
        if (location) {
            const locationUrl = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
            Alert.alert(
                t('shareLocation'),
                `Your current location:\nLat: ${location.coords.latitude.toFixed(6)}\nLng: ${location.coords.longitude.toFixed(6)}\n\n${locationUrl}`,
                [{ text: t('ok') }]
            );
        } else {
            Alert.alert(t('error'), t('locationPermissionRequired'));
        }
    };

    const recenterMap = () => {
        if (location && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
        }
    };

    // Auto-fit map to show route when a trip request arrives
    useEffect(() => {
        if (incomingTrip && location && mapRef.current) {
            const coords = [
                { latitude: location.coords.latitude, longitude: location.coords.longitude },
                { latitude: incomingTrip.pickup_lat, longitude: incomingTrip.pickup_lng },
                { latitude: incomingTrip.dest_lat, longitude: incomingTrip.dest_lng }
            ];

            // Use a small timeout to ensure the modal/UI doesn't conflict with animation
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 100, right: 100, bottom: 400, left: 100 },
                    animated: true,
                });
            }, 500);
        }
    }, [incomingTrip]);

    return (
        <View style={styles.container}>
            {/* --- MAP LAYER --- */}
            <MapView
                ref={mapRef}
                style={styles.mapLayer}
                initialRegion={location ? {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                } : DEFAULT_REGION}
                showsUserLocation={true}
                customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
                <MapTileLayer isDark={isDark} useNavStyle />
                <SurgeMapLayer />

                {incomingTrip && (
                    <>
                        {/* Pickup Marker */}
                        <Marker
                            coordinate={{ latitude: incomingTrip.pickup_lat, longitude: incomingTrip.pickup_lng }}
                            title={t('pickup')}
                            pinColor={colors.primary}
                        />
                        {/* Destination Marker */}
                        <Marker
                            coordinate={{ latitude: incomingTrip.dest_lat, longitude: incomingTrip.dest_lng }}
                            title={t('destination')}
                            pinColor={colors.danger}
                        />

                        {/* Route: Driver -> Pickup -> Destination */}
                        <Polyline
                            coordinates={[
                                { latitude: location?.coords.latitude || 0, longitude: location?.coords.longitude || 0 },
                                { latitude: incomingTrip.pickup_lat, longitude: incomingTrip.pickup_lng },
                                { latitude: incomingTrip.dest_lat, longitude: incomingTrip.dest_lng }
                            ]}
                            strokeColor={colors.primary}
                            strokeWidth={4}
                            lineDashPattern={[5, 5]}
                        />
                    </>
                )}
            </MapView>

            {/* --- UI OVERLAY --- */}
            <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">

                {/* Header */}
                <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity
                        style={[
                            styles.menuButton,
                            { backgroundColor: colors.surface, ...shadow('s') }
                        ]}
                        onPress={() => setSideMenuVisible(true)}
                    >
                        <Menu color={colors.textPrimary} size={24} />
                    </TouchableOpacity>

                    {/* Earnings Pill */}
                    <TouchableOpacity style={[
                        styles.earningsPill,
                        {
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            backgroundColor: colors.surface,
                            ...shadow('s')
                        }
                    ]} onPress={() => navigation.navigate('DriverWallet')}>
                        <CircleDollarSign size={20} color={colors.primary} />
                        <Text variant="h3" style={{ color: colors.textPrimary }}>
                            EGP {dailyEarnings.toFixed(2)}
                            {walletBalance < -100 && <Text variant="caption" style={{ color: colors.danger }}> (!)</Text>}
                        </Text>
                    </TouchableOpacity>

                    {/* Driver Profile Pic */}
                    <View style={styles.profileContainer}>
                        {driverProfile?.profile_photo_url ? (
                            <CachedImage source={{ uri: driverProfile.profile_photo_url }} style={styles.profileImage} />
                        ) : (
                            <View style={[styles.profileImage, { backgroundColor: '#ccc' }]} />
                        )}
                        <View style={[
                            styles.statusDot,
                            isRTL ? { left: 0 } : { right: 0 },
                            { backgroundColor: isOnline ? '#10B981' : '#9CA3AF' }
                        ]} />
                    </View>
                </View>

                {/* Floating Controls */}
                <View style={[styles.rightControls, isRTL && { left: 20, right: undefined }]} pointerEvents="box-none">
                    <TouchableOpacity
                        style={[
                            styles.iconButton,
                            { backgroundColor: colors.surface, ...shadow('s') }
                        ]}
                        onPress={handleSOS}
                    >
                        <Shield color={colors.textPrimary} size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.iconButton,
                            { marginTop: 12, backgroundColor: colors.surface, ...shadow('s') }
                        ]}
                        onPress={recenterMap}
                    >
                        <Navigation color={colors.textPrimary} size={24} />
                    </TouchableOpacity>
                </View>

                {/* Bottom Action Area */}
                <View style={styles.bottomContainer}>
                    {isOnline && (
                        <View style={styles.onlineStatusContainer}>
                            <Animated.View style={[styles.radarPulse, { transform: [{ scale: pulseAnim }], borderColor: colors.primary }]} />
                            <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>{t('findingTrips')}</Text>
                        </View>
                    )}

                    <Button
                        title={isOnline ? t('goOffline') : t('goOnline')}
                        onPress={toggleOnline}
                        variant={isOnline ? 'destructive' : 'primary'}
                        size="l"
                        style={{ width: '100%' }}
                    />
                </View>

            </SafeAreaView>

            {/* Side Menu Component */}
            <PopupNotification role="driver" />
            <DriverSideMenu
                visible={isSideMenuVisible}
                onClose={() => setSideMenuVisible(false)}
                initialProfile={driverProfile}
            />

            <SafetyModal
                visible={safetyModalVisible}
                onClose={() => setSafetyModalVisible(false)}
                onCallEmergency={handleCallEmergency}
                onSendSOS={handleSendSOS}
                onShareLocation={handleShareLocation}
            />

            <TripRequestModal
                visible={!!incomingTrip}
                trip={incomingTrip}
                onAccept={handleAcceptTrip}
                onDecline={handleDeclineTrip}
                // @ts-ignore
                onBid={handleBidTrip}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    mapLayer: { ...StyleSheet.absoluteFillObject },

    overlayContainer: { flex: 1, justifyContent: 'space-between' },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 10,
        paddingBottom: 10,
    },
    menuButton: {
        width: 44, height: 44,
        borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        // Shadow handled inline or via theme
    },
    earningsPill: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: 25,
        // Shadow handled inline
    },
    earningsText: {
        fontSize: 16, fontWeight: 'bold', color: '#1e1e1e'
    },
    profileContainer: { position: 'relative' },
    profileImage: {
        width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff',
    },
    statusDot: {
        position: 'absolute', bottom: 0,
        // right/left is now handled inline
        width: 14, height: 14, borderRadius: 7,
        borderWidth: 2, borderColor: '#fff'
    },

    rightControls: {
        position: 'absolute',
        right: 20,
        top: Platform.OS === 'android' ? 180 : 150,
        alignItems: 'center'
    },
    iconButton: {
        width: 44, height: 44,
        backgroundColor: '#fff', borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3
    },

    bottomContainer: {
        padding: 24,
        paddingBottom: Platform.OS === 'android' ? 50 : 40,
        alignItems: 'center'
    },
    onlineStatusContainer: {
        marginBottom: 30,
        alignItems: 'center', justifyContent: 'center',
        height: 60,
    },
    radarPulse: {
        position: 'absolute',
        width: 200, height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
    },
    findingText: {
        fontSize: 18, fontWeight: '600', color: '#1e1e1e',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, overflow: 'hidden'
    },
    goButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6
    },
    goButtonText: {
        color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 1
    }
});
