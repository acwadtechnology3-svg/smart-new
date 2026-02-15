import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Image, AppState, Linking, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';
import { Phone, MessageSquare, Navigation } from 'lucide-react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import * as Location from 'expo-location';
import { apiRequest } from '../../services/backend';
import { realtimeClient } from '../../services/realtimeClient';
import { getDirections } from '../../services/mapService';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const { width } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function DriverActiveTripScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RootStackParamList, 'DriverActiveTrip'>>();
    const { tripId, initialTripData } = route.params as any;
    const { t, isRTL } = useLanguage();
    const { colors, isDark, shadow, radius, spacing } = useTheme();

    const [trip, setTrip] = useState<any>(initialTripData || null);
    const [loading, setLoading] = useState(!initialTripData);
    const [driverLoc, setDriverLoc] = useState<any>(null);
    const [routeCoords, setRouteCoords] = useState<any[]>([]);
    const [waitingTime, setWaitingTime] = useState<string>('5:00');
    const [isPaidWaiting, setIsPaidWaiting] = useState(false);
    const mapRef = useRef<MapView>(null);

    // 1. Fetch Trip Details & Subscriptions
    useEffect(() => {
        fetchTrip();
        startLocationTracking();

        const appStateSub = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                handleCheckStatus();
            }
        });

        let unsubscribe: (() => void) | null = null;
        (async () => {
            unsubscribe = await realtimeClient.subscribe(
                { channel: 'trip:status', tripId },
                (payload) => {
                    const newTrip = payload.new;
                    if (newTrip) {
                        setTrip(newTrip);
                    }
                }
            );
        })();

        const interval = setInterval(() => {
            handleCheckStatus();
        }, 3000); // Polling every 3s is enough usually

        return () => {
            if (unsubscribe) unsubscribe();
            clearInterval(interval);
            appStateSub.remove();
        };
    }, [tripId]);

    // Timer Logic for Waiting Time
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (trip?.status === 'arrived' && trip.arrived_at) {
            const arrivedAt = new Date(trip.arrived_at).getTime();

            interval = setInterval(() => {
                const now = new Date().getTime();
                const diffMs = now - arrivedAt;

                // 5 minutes free waiting
                const freeTimeMs = 5 * 60 * 1000;

                if (diffMs < freeTimeMs) {
                    setIsPaidWaiting(false);
                    const remainingMs = freeTimeMs - diffMs;
                    const m = Math.floor(remainingMs / 60000);
                    const s = Math.floor((remainingMs % 60000) / 1000);
                    setWaitingTime(`${m}:${s < 10 ? '0' + s : s}`);
                } else {
                    setIsPaidWaiting(true);
                    const paidMs = diffMs - freeTimeMs;
                    const m = Math.floor(paidMs / 60000);
                    const s = Math.floor((paidMs % 60000) / 1000);
                    setWaitingTime(`${m}:${s < 10 ? '0' + s : s}`);
                }
            }, 1000);
        } else {
            setWaitingTime('5:00');
            setIsPaidWaiting(false);
        }
        return () => clearInterval(interval);
    }, [trip?.status, trip?.arrived_at]);

    // 2. Monitor Status Cancellation
    useEffect(() => {
        if (trip?.status === 'cancelled') {
            navigation.navigate('DriverHome' as any, { autoOnline: true });
            setTimeout(() => {
                Alert.alert(t('tripCancelled'), t('passengerCancelled'));
            }, 500);
        }
    }, [trip?.status]);

    const handleCheckStatus = async () => {
        try {
            const data = await apiRequest<{ trip: any }>(`/trips/${tripId}`);
            if (data.trip) {
                setTrip((prev: any) => {
                    if (prev && prev.status !== data.trip.status) {
                        return { ...prev, status: data.trip.status };
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.log("Polling error:", err);
        }
    };

    const fetchTrip = async () => {
        try {
            const data = await apiRequest<{ trip: any }>(`/trips/${tripId}/detail`);
            setTrip(data.trip);
            setLoading(false);
        } catch (error: any) {
            Alert.alert(t('error'), "Could not load trip details.");
            navigation.goBack();
        }
    };

    const startLocationTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({});
        setDriverLoc(loc.coords);
    };

    // Calculate directions
    useEffect(() => {
        if (!trip || !driverLoc) return;

        const getRoute = async () => {
            let destination: [number, number];
            if (trip.status === 'accepted' || trip.status === 'arrived') {
                destination = [trip.pickup_lng, trip.pickup_lat];
            } else {
                destination = [trip.dest_lng, trip.dest_lat];
            }

            const data = await getDirections([driverLoc.longitude, driverLoc.latitude], destination);
            if (data) {
                const points = data.geometry.coordinates.map((pt: any) => ({
                    latitude: pt[1],
                    longitude: pt[0]
                }));
                setRouteCoords(points);
                mapRef.current?.fitToCoordinates(points, {
                    edgePadding: { top: 50, right: 50, bottom: 350, left: 50 },
                    animated: true
                });
            }
        };

        getRoute();
    }, [trip?.status, driverLoc]);

    const onCallPress = () => {
        if (trip?.customer?.phone) {
            Linking.openURL(`tel:${trip.customer.phone}`);
        } else {
            Alert.alert(t('error'), t('noPhone') || 'No phone number available');
        }
    };

    const onChatPress = () => {
        if (trip?.id) {
            navigation.navigate('Chat', {
                tripId: trip.id,
                driverName: trip.customer?.full_name || 'Passenger',
                role: 'driver'
            });
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        try {
            const latestTrip = await apiRequest<{ trip: any }>(`/trips/${tripId}`);
            if (latestTrip.trip?.status === 'cancelled') {
                Alert.alert(t('tripCancelled'), t('passengerCancelled'));
                navigation.navigate('DriverHome' as any, { autoOnline: true });
                return;
            }

            const response = await apiRequest<{ success: boolean; trip: any }>('/trips/update-status', {
                method: 'POST',
                body: JSON.stringify({ tripId, status: newStatus })
            });

            if (response.success) {
                if (newStatus === 'completed') {
                    Alert.alert(t('success'), t('tripFinished'), [{ text: t('ok'), onPress: () => navigation.navigate('DriverHome', { autoOnline: true }) }]);
                } else {
                    setTrip(response.trip);
                }
            }
        } catch (error: any) {
            Alert.alert(t('error'), error?.message || "Failed to update status.");
        }
    };

    if (loading || !trip) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const currentStatus = trip.status;
    const rowStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' } as any;
    const textAlign = { textAlign: isRTL ? 'right' : 'left' } as any;

    const getStatusText = () => {
        switch (currentStatus) {
            case 'accepted': return t('drivingToPickup');
            case 'arrived': return t('atPickup');
            case 'started': return t('onTrip');
            case 'cancelled': return t('tripCancelled');
            default: return t('tripFinished');
        }
    };

    const openNavigationApp = () => {
        let destLat: number, destLng: number;
        let label = '';

        if (currentStatus === 'accepted' || currentStatus === 'arrived') {
            destLat = trip.pickup_lat;
            destLng = trip.pickup_lng;
            label = 'Pickup';
        } else {
            destLat = trip.dest_lat;
            destLng = trip.dest_lng;
            label = 'Destination';
        }

        Alert.alert(
            t('navigate'),
            t('chooseMapApp'),
            [
                {
                    text: 'Google Maps',
                    onPress: () => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
                        Linking.openURL(url);
                    }
                },
                {
                    text: 'Waze',
                    onPress: () => {
                        const url = `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;
                        Linking.openURL(url);
                    }
                },
                {
                    text: t('cancel'),
                    style: 'cancel'
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Home Button for Travel Requests */}
            {trip?.is_travel_request && (
                <TouchableOpacity
                    style={[styles.homeButton, { backgroundColor: colors.surface, ...shadow('s') }]}
                    onPress={() => navigation.navigate('DriverHome')}
                >
                    <Navigation size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            )}

            <View style={styles.navigationButtonContainer}>
                <TouchableOpacity style={[styles.navigationButton, { backgroundColor: colors.primary }]} onPress={openNavigationApp}>
                    <Navigation size={28} color={colors.textOnPrimary} fill={colors.textOnPrimary} />
                </TouchableOpacity>
            </View>
            <MapView
                key={`driver-active-trip-map-${isDark ? 'dark' : 'light'}`}
                ref={mapRef}
                style={[styles.map, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                initialRegion={{
                    latitude: driverLoc?.latitude || trip.pickup_lat,
                    longitude: driverLoc?.longitude || trip.pickup_lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                }}
                mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
                <MapTileLayer isDark={isDark} useNavStyle />
                {driverLoc && (
                    <Marker coordinate={driverLoc} title={t('myVehicle')}>
                        <View style={[styles.driverMarker, { backgroundColor: colors.primary }]}>
                            <Navigation size={20} color={colors.textOnPrimary} fill={colors.textOnPrimary} transform={[{ rotate: '45deg' }]} />
                        </View>
                    </Marker>
                )}
                <Marker coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }} title={t('pickup')}>
                    <View style={[styles.dotMarker, { backgroundColor: Colors.success }]} />
                </Marker>
                <Marker coordinate={{ latitude: trip.dest_lat, longitude: trip.dest_lng }} title={t('dropoff')}>
                    <View style={[styles.dotMarker, { backgroundColor: Colors.danger }]} />
                </Marker>
                {routeCoords.length > 0 && (
                    <Polyline coordinates={routeCoords} strokeWidth={5} strokeColor={Colors.primary} />
                )}
            </MapView>

            <View style={[styles.topBanner, { backgroundColor: colors.surface, ...shadow('m') }]}>
                <Text variant="caption" style={{ color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>{getStatusText()}</Text>
                <Text variant="h3" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {currentStatus === 'started' ? trip.dest_address : trip.pickup_address}
                </Text>
            </View>

            <View style={[styles.bottomSheet, { backgroundColor: colors.surface, borderTopColor: colors.border, borderWidth: 1, ...shadow('l') }]}>
                <View style={[styles.passengerInfo, rowStyle]}>
                    <View style={[styles.avatar, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16, marginLeft: 0 }, { backgroundColor: colors.background }]}>
                        <Image source={{ uri: 'https://ui-avatars.com/api/?name=' + trip.customer?.full_name }} style={styles.avatarImg} />
                    </View>
                    <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                        <Text variant="h3" style={{ color: colors.textPrimary }}>{trip.customer?.full_name || 'Passenger'}</Text>
                        <Text variant="small" style={{ color: colors.textSecondary }}>{t('payment')}: {trip.payment_method?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.actionIcons}>
                        <TouchableOpacity style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]} onPress={onCallPress}>
                            <Phone size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]} onPress={onChatPress}>
                            <MessageSquare size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.earningsRow, rowStyle, { backgroundColor: colors.background }]}>
                    <Text variant="body" style={{ color: colors.textSecondary }}>{t('tripEarnings') || t('estEarnings')}</Text>
                    <Text variant="h3" style={{ color: colors.primary }}>{trip.price} EGP</Text>
                </View>

                {currentStatus === 'accepted' && (
                    <Button
                        title={t('arrivedAtPickup')}
                        onPress={() => handleUpdateStatus('arrived')}
                        size="l"
                        variant="primary"
                    />
                )}

                {currentStatus === 'arrived' && (
                    <View style={{ width: '100%' }}>
                        <View style={[styles.timerContainer, { backgroundColor: colors.background }]}>
                            <Text variant="small" style={{ color: colors.textSecondary, marginBottom: 4 }}>
                                {isPaidWaiting ? (t('paidWaiting') || 'Paid Waiting Time') : (t('freeWaiting') || 'Free Waiting Time')}
                            </Text>
                            <Text variant="h1" style={{ color: isPaidWaiting ? colors.danger : colors.success, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                {waitingTime}
                            </Text>
                        </View>
                        <Button
                            title={t('startTrip')}
                            onPress={() => handleUpdateStatus('started')}
                            size="l"
                            variant="secondary"
                        />
                    </View>
                )}

                {currentStatus === 'started' && (
                    <Button
                        title={t('completeTrip')}
                        onPress={() => handleUpdateStatus('completed')}
                        size="l"
                        variant="destructive"
                    />
                )}

                <TouchableOpacity style={{ alignSelf: 'center', marginTop: 16 }} onPress={handleCheckStatus}>
                    <Text variant="caption" style={{ color: colors.textMuted }}>{t('refreshStatus')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    map: { flex: 1 },
    topBanner: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, elevation: 5, alignItems: 'center', zIndex: 10 },
    statusTitle: { fontSize: 12, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 },
    addressText: { fontSize: 16, fontWeight: 'bold', color: '#1e1e1e' },

    bottomSheet: { position: 'absolute', bottom: 0, width: width, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.1, elevation: 20 },
    passengerInfo: { alignItems: 'center', marginBottom: 24 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    customerName: { fontSize: 18, fontWeight: 'bold', color: '#1e1e1e' },
    customerSub: { fontSize: 14, color: '#6B7280' },
    actionIcons: { flexDirection: 'row', gap: 12 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },

    earningsRow: { justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 24 },
    earningsLabel: { fontSize: 16, color: '#4B5563' },
    earningsValue: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },

    mainBtn: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    mainBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    driverMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, elevation: 5 },
    dotMarker: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, elevation: 5 },

    timerContainer: { alignItems: 'center', marginBottom: 16, backgroundColor: '#F3F4F6', padding: 12, borderRadius: 12 },
    timerLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
    timerValue: { fontSize: 24, fontWeight: 'bold', color: '#10B981', fontFamily: 'monospace' },

    // External Navigation Button
    navigationButtonContainer: {
        position: 'absolute',
        right: 20,
        bottom: width * 0.9, // Adjust height to be above bottom sheet roughly
        zIndex: 50,
    },
    navigationButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary, // Using primary color (blue)
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    homeButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        width: 44,
        height: 44,
        backgroundColor: '#fff',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 60
    },
});
