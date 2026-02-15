import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Phone, MessageSquare, ShieldCheck } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';
import MapView, { Marker } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import { apiRequest } from '../../services/backend';
import { tripStatusService } from '../../services/tripStatusService';
import { realtimeClient } from '../../services/realtimeClient';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

const { width } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type OnTripScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OnTrip'>;
type OnTripScreenRouteProp = RouteProp<RootStackParamList, 'OnTrip'>;

export default function OnTripScreen() {
    const navigation = useNavigation<OnTripScreenNavigationProp>();
    const route = useRoute<OnTripScreenRouteProp>();
    const { tripId } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef<MapView>(null);

    // Fetch trip data
    useEffect(() => {
        const fetchTrip = async () => {
            try {
                console.log("[OnTrip] Fetching trip:", tripId);
                const data = await apiRequest<{ trip: any }>(`/trips/${tripId}`);

                console.log("[OnTrip] Trip loaded successfully");
                setTrip(data.trip);
                setLoading(false);
            } catch (err) {
                console.error("[OnTrip] Fetch error:", err);
                Alert.alert("Error", "Failed to load trip");
                setLoading(false);
            }
        };

        fetchTrip();
    }, [tripId]);

    // Start trip status monitoring for completion/cancellation
    useEffect(() => {
        console.log('[OnTrip] Starting trip status monitoring for trip:', tripId);
        tripStatusService.startMonitoring(tripId);

        // Also subscribe to real-time updates for trip status changes
        let unsubscribe: (() => void) | null = null;
        (async () => {
            unsubscribe = await realtimeClient.subscribe(
                { channel: 'trip:status', tripId },
                (payload) => {
                    const newStatus = payload?.new?.status;
                    console.log('[OnTrip] Trip status update:', newStatus);
                    if (newStatus) {
                        setTrip((prev: any) => prev ? { ...prev, status: newStatus } : prev);
                    }
                }
            );
        })();

        return () => {
            console.log('[OnTrip] Cleaning up trip monitoring');
            if (unsubscribe) unsubscribe();
            // Don't stop tripStatusService here - it handles navigation on completion
        };
    }, [tripId]);

    const handleCancel = async () => {
        Alert.alert(
            "Cancel Trip",
            "Are you sure you want to cancel? A cancellation fee may apply.",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiRequest(`/trips/${tripId}/cancel`, { method: 'POST' });

                            Alert.alert("Trip Cancelled");
                            navigation.popToTop(); // Go back to map
                        } catch (err) {
                            Alert.alert("Error", "Failed to cancel trip");
                        }
                    }
                }
            ]
        );
    };

    const handleCall = () => {
        const phone = trip?.driver?.phone || trip?.driver?.user?.phone || trip?.driver?.mobile;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        } else {
            console.log("Trip Driver Data:", trip?.driver);
            Alert.alert("Error", "No driver phone number available.");
        }
    };

    if (loading || !trip) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('loading')}...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.topBar}>
                <TouchableOpacity style={[styles.cancelBtnTop, { backgroundColor: colors.surface, shadowColor: colors.shadow }]} onPress={handleCancel}>
                    <Text style={[styles.cancelTextTop, { color: colors.danger }]}>{t('cancelTrip')}</Text>
                </TouchableOpacity>
            </View>

            <MapView
                key={`on-trip-map-${isDark ? 'dark' : 'light'}`}
                ref={mapRef}
                style={[styles.map, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                initialRegion={{
                    latitude: trip.pickup_lat || 31.2357,
                    longitude: trip.pickup_lng || 29.9511,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05
                }}
                mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
                <MapTileLayer isDark={isDark} />
                <Marker
                    coordinate={{
                        latitude: trip.pickup_lat,
                        longitude: trip.pickup_lng
                    }}
                    title="Pickup"
                    pinColor={colors.primary}
                />
                <Marker
                    coordinate={{
                        latitude: trip.dest_lat,
                        longitude: trip.dest_lng
                    }}
                    title="Destination"
                    pinColor={colors.danger}
                />
            </MapView>

            <View style={[styles.bottomSheet, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tripInProgress')}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('takingYouToDest')}</Text>

                <View style={styles.tripInfo}>
                    <View style={styles.infoRow}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('from')}:</Text>
                        <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1}>{trip.pickup_address || t('pickupLocation')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('to')}:</Text>
                        <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1}>{trip.dest_address || t('destination')}</Text>
                    </View>
                </View>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                            <Phone size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{t('call')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Chat', {
                        driverName: trip?.driver?.full_name || trip?.driver?.user?.full_name || 'Driver',
                        tripId,
                        role: 'customer'
                    })}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                            <MessageSquare size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{t('chat')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Safety', { tripId })}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                            <ShieldCheck size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{t('safety')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={handleCancel}>
                        <View style={[styles.iconCircle, { borderColor: colors.danger, backgroundColor: isDark ? 'rgba(248,113,113,0.18)' : '#FEF2F2' }]}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.danger }}>X</Text>
                        </View>
                        <Text style={[styles.actionLabel, { color: colors.danger }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, fontSize: 16, color: Colors.textSecondary },
    map: { flex: 1 },
    topBar: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, alignItems: 'flex-end' },
    cancelBtnTop: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, elevation: 5 },
    cancelTextTop: { color: '#EF4444', fontWeight: 'bold' },
    bottomSheet: {
        position: 'absolute', bottom: 0, width: width, backgroundColor: '#fff',
        borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40,
        shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15
    },
    title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
    tripInfo: { marginBottom: 24 },
    infoRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
    label: { fontSize: 14, color: Colors.textSecondary, width: 60 },
    value: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    actionBtn: { alignItems: 'center', gap: 8 },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    actionLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
});
