import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Linking, Alert, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Phone, MessageSquare, Star, CarFront, ShieldCheck, Navigation } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';
import MapView, { Marker } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import { apiRequest } from '../../services/backend';
import { realtimeClient } from '../../services/realtimeClient';
import { tripStatusService } from '../../services/tripStatusService';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

const { width } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type DriverFoundScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DriverFound'>;
type DriverFoundScreenRouteProp = RouteProp<RootStackParamList, 'DriverFound'>;

export default function DriverFoundScreen() {
    const navigation = useNavigation<DriverFoundScreenNavigationProp>();
    const route = useRoute<DriverFoundScreenRouteProp>();
    const { tripId, driver } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    // Start global monitoring in case we restored state directly to this screen
    useEffect(() => {
        if (tripId) {
            tripStatusService.startMonitoring(tripId);
        }
    }, [tripId]);

    const [driverInfo, setDriverInfo] = useState<any>(driver || null);
    const [driverLoc, setDriverLoc] = useState({
        latitude: driver?.lat || 31.2357,
        longitude: driver?.lng || 29.9511
    });
    const [isArrived, setIsArrived] = useState(false);
    const [isTravelRequest, setIsTravelRequest] = useState(false);
    const arrivedRef = useRef(false);
    const mapRef = useRef<MapView>(null);

    useEffect(() => {
        arrivedRef.current = isArrived;
    }, [isArrived]);

    // Fetch driver info if not provided (e.g., from polling fallback)
    useEffect(() => {
        if (!driver && tripId) {
            (async () => {
                try {
                    const tripData = await apiRequest<{ trip: any }>(`/trips/${tripId}`);
                    if (tripData.trip) {
                        setIsTravelRequest(tripData.trip.is_travel_request || false);
                    }
                    if (tripData.trip?.driver_id) {
                        const response = await apiRequest<{ driver: any }>(`/drivers/public/${tripData.trip.driver_id}?tripId=${tripId}`);
                        if (response.driver) {
                            const data = response.driver;
                            setDriverInfo({
                                id: data.id,
                                name: data.users?.full_name || 'Driver',
                                phone: data.users?.phone,
                                rating: data.rating || '5.0',
                                image: data.profile_photo_url,
                                car: data.vehicle_model,
                                plate: data.vehicle_plate,
                                color: data.vehicle_color,
                                lat: data.current_lat,
                                lng: data.current_lng,
                                eta: '5 min',
                            });
                            if (typeof data.current_lat === 'number' && typeof data.current_lng === 'number') {
                                setDriverLoc({ latitude: data.current_lat, longitude: data.current_lng });
                            }
                        }
                    }
                } catch (err) {
                    console.error('[DriverFound] Failed to fetch trip/driver info:', err);
                }
            })();
        }
    }, [driver, tripId]);

    // Refresh driver info periodically if driver was provided
    useEffect(() => {
        if (!driver?.id || !tripId) return;

        let active = true;
        (async () => {
            try {
                const response = await apiRequest<{ driver: any }>(`/drivers/public/${driver.id}?tripId=${tripId}`);
                if (!active || !response.driver) return;
                const data = response.driver;

                setDriverInfo({
                    id: data.id,
                    name: data.users?.full_name || driver?.name || 'Driver',
                    phone: data.users?.phone || driver?.phone,
                    rating: data.rating || driver?.rating,
                    image: data.profile_photo_url || driver?.image,
                    car: data.vehicle_model || driver?.car,
                    plate: data.vehicle_plate || driver?.plate,
                    color: data.vehicle_color || driver?.color,
                    lat: data.current_lat || driver?.lat,
                    lng: data.current_lng || driver?.lng,
                    eta: driver?.eta,
                });

                if (typeof data.current_lat === 'number' && typeof data.current_lng === 'number') {
                    const newPos = { latitude: data.current_lat, longitude: data.current_lng };
                    setDriverLoc(newPos);
                }
            } catch (err) {
                console.error('[DriverFound] Failed to fetch driver info:', err);
            }
        })();

        return () => {
            active = false;
        };
    }, [driver?.id, tripId]);

    const displayDriver = driverInfo || driver;

    // Listen for driver location and "arrived" status only
    // Global service handles all navigation
    // Listen for driver location and status changes
    useEffect(() => {
        const idToMonitor = driverInfo?.id || driver?.id;
        if (!idToMonitor || !tripId) return;

        console.log("[DriverFound] Setting up listeners with Driver ID:", idToMonitor);

        let unsubLocation: (() => void) | null = null;
        let unsubStatus: (() => void) | null = null;

        (async () => {
            // 1. Driver Location Subscription
            unsubLocation = await realtimeClient.subscribe(
                { channel: 'driver:location', tripId, driverId: idToMonitor },
                (payload) => {
                    const lat = payload?.new?.current_lat;
                    const lng = payload?.new?.current_lng;
                    if (typeof lat === 'number' && typeof lng === 'number') {
                        const newPos = { latitude: lat, longitude: lng };
                        setDriverLoc(newPos);
                        // Animate marker slightly
                        if (mapRef.current) {
                            // mapRef.current.animateCamera({ center: newPos, heading: payload?.new?.heading || 0 }); 
                        }
                    }
                }
            );

            // 2. Trip Status Subscription
            unsubStatus = await realtimeClient.subscribe(
                { channel: 'trip:status', tripId },
                (payload) => {
                    const status = payload?.new?.status;
                    console.log("[DriverFound] Realtime Status Update:", status);

                    if (isTravelRequest) {
                        // For travel requests, we don't want to force navigation away if the user is elsewhere
                        // However, if they ARE on this screen, they might still want to see the status update (like Arrived)
                        if (status === 'arrived' && !arrivedRef.current) {
                            arrivedRef.current = true;
                            setIsArrived(true);
                            Alert.alert(t('driverArrived'), t('captainReached'), [{ text: "OK" }]);
                        }
                        console.log("[DriverFound] Travel request status update, skipping navigation:", status);
                        return;
                    }

                    if (status === 'arrived' && !arrivedRef.current) {
                        arrivedRef.current = true;
                        setIsArrived(true);
                        Alert.alert(
                            t('driverArrived'),
                            t('captainReached'),
                            [{ text: "OK" }]
                        );
                    } else if (status === 'started') {
                        console.log("Trip Started! Navigating to OnTrip...");
                        navigation.replace('OnTrip', { tripId });
                    } else if (status === 'completed') {
                        console.log("Trip Completed! Navigating to Home...");
                        // Or Rating Screen
                        Alert.alert(t('tripFinished'), t('hopeYouEnjoyed'));
                        navigation.navigate('CustomerHome');
                    } else if (status === 'cancelled') {
                        Alert.alert(t('tripCancelled'), t('driverCancelled'));
                        navigation.navigate('CustomerHome');
                    }
                }
            );
        })();

        return () => {
            if (unsubLocation) unsubLocation();
            if (unsubStatus) unsubStatus();
        };
    }, [driverInfo?.id, driver?.id, tripId]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <MapView
                key={`driver-found-map-${isDark ? 'dark' : 'light'}`}
                ref={mapRef}
                style={[styles.map, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                initialRegion={{
                    latitude: driverLoc.latitude,
                    longitude: driverLoc.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                }}
                mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
                <MapTileLayer isDark={isDark} />
                <Marker coordinate={driverLoc}>
                    <View style={[styles.carMarker, { backgroundColor: colors.primary, borderColor: colors.surface, shadowColor: colors.shadow }]}>
                        <Navigation size={18} color={colors.textOnPrimary} fill={colors.textOnPrimary} transform={[{ rotate: '45deg' }]} />
                    </View>
                </Marker>
            </MapView>

            {/* Home Button for Scheduled Trips */}
            {isTravelRequest && (
                <TouchableOpacity
                    style={[styles.homeButton, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
                    onPress={() => navigation.navigate('CustomerHome')}
                >
                    <Navigation size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            )}

            <View style={[styles.bottomSheet, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <View style={styles.statusHeader}>
                    <Text style={[styles.etaText, { color: colors.textPrimary }, isArrived && { color: colors.success }]}>
                        {isArrived ? t('driverArriving') : `${t('arrivingIn')} ${displayDriver?.eta || '2 ' + t('minutes')}`}
                    </Text>
                    <Text style={[styles.plateText, { color: colors.textPrimary, backgroundColor: colors.surface2 }]}>{displayDriver?.plate || 'ABC 123'}</Text>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.driverSection}>
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface2 }]}>
                            <Image
                                source={{ uri: displayDriver?.image || 'https://ui-avatars.com/api/?name=' + (displayDriver?.name || 'Driver') }}
                                style={styles.avatar}
                            />
                        </View>
                        <View style={styles.driverTexts}>
                            <Text style={[styles.driverName, { color: colors.textPrimary }]}>{displayDriver?.name || t('driver')}</Text>
                            <View style={styles.ratingRow}>
                                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                <Text style={[styles.ratingText, { color: colors.textPrimary }]}>{displayDriver?.rating || '5.0'}</Text>
                                <Text style={[styles.tripCount, { color: colors.textMuted }]}>(1,240 trips)</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.carSection}>
                        <CarFront size={28} color={colors.primary} />
                        <Text style={[styles.carModel, { color: colors.textPrimary }]}>{displayDriver?.car || t('vehicle')}</Text>
                        <Text style={[styles.carColor, { color: colors.textMuted }]}>{displayDriver?.color || 'Silver'}</Text>
                    </View>
                </View>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                            const phoneNumber = displayDriver?.phone || displayDriver?.phone_number || '';
                            if (phoneNumber) {
                                Linking.openURL(`tel:${phoneNumber}`);
                            } else {
                                Alert.alert('No Phone Number', 'Driver phone number not available');
                            }
                        }}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                            <Phone size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Chat', { driverName: displayDriver?.name || 'Captain', tripId })}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                            <MessageSquare size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Chat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Safety', { tripId })}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                            <ShieldCheck size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Safety</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footerBtns}>
                    <TouchableOpacity
                        style={[styles.cancelBtn, { borderColor: colors.danger }]}
                        onPress={() => {
                            Alert.alert("Cancel Trip", "Are you sure? A cancellation fee may apply.", [
                                { text: "No", style: 'cancel' },
                                {
                                    text: "Yes, Cancel",
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            await apiRequest(`/trips/${tripId}/cancel`, { method: 'POST' });

                                            // 2. Navigate Back
                                            navigation.popToTop();
                                        } catch (e: any) {
                                            console.error("Cancellation Error", e);

                                            // 👽 Optimization: If trip is already completed, just exit
                                            if (e.message?.includes('completed') || e.error?.includes('completed')) {
                                                Alert.alert(t('tripFinished'), t('tripCompleted'));
                                                navigation.navigate('CustomerHome');
                                            } else {
                                                Alert.alert(t('error'), t('genericError'));
                                            }
                                        }
                                    }
                                }
                            ])
                        }}
                    >
                        <Text style={[styles.cancelBtnText, { color: colors.danger }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { flex: 1 },
    carMarker: {
        width: 40, height: 40, backgroundColor: Colors.primary, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
    },
    homeButton: {
        position: 'absolute', top: 50, left: 20, width: 44, height: 44,
        backgroundColor: '#fff', borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3, zIndex: 50
    },
    bottomSheet: {
        position: 'absolute', bottom: 0, width: width, backgroundColor: '#fff',
        borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40,
        shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15
    },
    statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    etaText: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary },
    plateText: { fontSize: 14, fontWeight: 'bold', color: '#111827', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, letterSpacing: 1 },
    infoCard: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' },
    driverSection: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E5E7EB', overflow: 'hidden' },
    avatar: { width: '100%', height: '100%' },
    driverTexts: { justifyContent: 'center' },
    driverName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    ratingText: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    tripCount: { fontSize: 12, color: '#6B7280' },
    carSection: { alignItems: 'flex-end' },
    carModel: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginTop: 4 },
    carColor: { fontSize: 12, color: '#6B7280' },
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
    actionBtn: { alignItems: 'center', gap: 8 },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    actionLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
    footerBtns: { flexDirection: 'row' },
    cancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 16 },
    cancelBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 },
});
