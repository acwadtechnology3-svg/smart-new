import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Phone, MessageSquare, ShieldCheck } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import MapView, { Marker } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import { apiRequest } from '../../services/backend';
import { tripStatusService } from '../../services/tripStatusService';
import { realtimeClient } from '../../services/realtimeClient';
import { useLanguage } from '../../context/LanguageContext';

const { width } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type OnTripScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OnTrip'>;
type OnTripScreenRouteProp = RouteProp<RootStackParamList, 'OnTrip'>;

export default function OnTripScreen() {
    const navigation = useNavigation<OnTripScreenNavigationProp>();
    const route = useRoute<OnTripScreenRouteProp>();
    const { tripId } = route.params;
    const { t, isRTL } = useLanguage();

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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>{t('loading')}...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.cancelBtnTop} onPress={handleCancel}>
                    <Text style={styles.cancelTextTop}>{t('cancelTrip')}</Text>
                </TouchableOpacity>
            </View>

            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    latitude: trip.pickup_lat || 31.2357,
                    longitude: trip.pickup_lng || 29.9511,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05
                }}
            >
                <MapTileLayer isDark={false} />
                <Marker
                    coordinate={{
                        latitude: trip.pickup_lat,
                        longitude: trip.pickup_lng
                    }}
                    title="Pickup"
                    pinColor={Colors.primary}
                />
                <Marker
                    coordinate={{
                        latitude: trip.dest_lat,
                        longitude: trip.dest_lng
                    }}
                    title="Destination"
                    pinColor="red"
                />
            </MapView>

            <View style={styles.bottomSheet}>
                <Text style={styles.title}>{t('tripInProgress')}</Text>
                <Text style={styles.subtitle}>{t('takingYouToDest')}</Text>

                <View style={styles.tripInfo}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>{t('from')}:</Text>
                        <Text style={styles.value} numberOfLines={1}>{trip.pickup_address || t('pickupLocation')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>{t('to')}:</Text>
                        <Text style={styles.value} numberOfLines={1}>{trip.dest_address || t('destination')}</Text>
                    </View>
                </View>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                        <View style={styles.iconCircle}>
                            <Phone size={24} color={Colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>{t('call')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Chat', {
                        driverName: trip?.driver?.full_name || trip?.driver?.user?.full_name || 'Driver',
                        tripId,
                        role: 'customer'
                    })}>
                        <View style={styles.iconCircle}>
                            <MessageSquare size={24} color={Colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>{t('chat')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Safety', { tripId, trip })}>
                        <View style={styles.iconCircle}>
                            <ShieldCheck size={24} color={Colors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>{t('safety')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={handleCancel}>
                        <View style={[styles.iconCircle, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#EF4444' }}>X</Text>
                        </View>
                        <Text style={[styles.actionLabel, { color: '#EF4444' }]}>{t('cancel')}</Text>
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
