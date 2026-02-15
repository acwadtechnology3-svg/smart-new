import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Alert, Image, ScrollView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, MapPin, Navigation as NavigationIcon, Car, Star, User, Palette } from 'lucide-react-native';
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

const { width, height } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type SearchingDriverScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SearchingDriver'>;
type SearchingDriverScreenRouteProp = RouteProp<RootStackParamList, 'SearchingDriver'>;

export default function SearchingDriverScreen() {
    const navigation = useNavigation<SearchingDriverScreenNavigationProp>();
    const mapRef = useRef<MapView>(null);
    const route = useRoute<SearchingDriverScreenRouteProp>();
    const { tripId } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    const [isSearching, setIsSearching] = useState(true);
    const [offers, setOffers] = useState<any[]>([]);

    // Start global trip monitoring service
    React.useEffect(() => {
        console.log('[SearchingDriver] Starting global trip monitor');
        tripStatusService.startMonitoring(tripId);

        return () => {
            // Don't stop monitoring here - let it continue across screens
            console.log('[SearchingDriver] Screen unmounting but keeping monitor active');
        };
    }, [tripId]);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Rotate animation
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 3000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Fetch trip details for map
    const [trip, setTrip] = useState<any>(null);

    useEffect(() => {
        const fetchTrip = async () => {
            try {
                const data = await apiRequest<{ trip: any }>(`/trips/${tripId}`);
                if (data.trip) {
                    setTrip(data.trip);

                    // Fit map to markers
                    setTimeout(() => {
                        mapRef.current?.fitToCoordinates([
                            { latitude: parseFloat(data.trip.pickup_lat), longitude: parseFloat(data.trip.pickup_lng) },
                            { latitude: parseFloat(data.trip.dest_lat), longitude: parseFloat(data.trip.dest_lng) }
                        ], {
                            edgePadding: { top: 100, right: 50, bottom: height / 2, left: 50 },
                            animated: true
                        });
                    }, 1000);
                }
            } catch {
                // ignore
            }
        };
        fetchTrip();
    }, [tripId]);

    // Listen for trip offers and status changes
    useEffect(() => {
        console.log('[SearchingDriver] Listening for offers on trip:', tripId);

        let unsubOffers: (() => void) | null = null;
        let unsubStatus: (() => void) | null = null;
        let pollInterval: NodeJS.Timeout | null = null;
        let isNavigating = false;

        // Fallback polling in case realtime doesn't fire
        pollInterval = setInterval(async () => {
            if (isNavigating) return;
            try {
                const data = await apiRequest<{ trip: any }>(`/trips/${tripId}?t=${Date.now()}`);
                if (data.trip?.status === 'accepted' && data.trip?.driver_id && !isNavigating) {
                    console.log('[SearchingDriver] Poll detected accepted trip, navigating...');
                    isNavigating = true;
                    navigation.replace('DriverFound', { tripId });
                } else {
                    // Poll for offers if not accepted yet
                    try {
                        const offersData = await apiRequest<{ offers: any[] }>(`/trip-offers?tripId=${tripId}&t=${Date.now()}`);
                        if (offersData.offers && offersData.offers.length > 0) {
                            setOffers(prev => {
                                const existingIds = new Set(prev.map(o => o.id));
                                const newOffers = offersData.offers.filter(o => !existingIds.has(o.id));
                                if (newOffers.length === 0) return prev;
                                return [...prev, ...newOffers];
                            });
                        }
                    } catch (offerErr) {
                        console.log('Poll offers error:', offerErr);
                    }
                }
            } catch (e) {
                // ignore polling errors
            }
        }, 3000); // Poll every 3 seconds

        (async () => {
            unsubOffers = await realtimeClient.subscribe(
                { channel: 'trip:offers', tripId },
                (payload) => {
                    console.log('[SearchingDriver] New offer received:', payload.new);
                    const driverData = payload.new?.driver;
                    let offerToAdd = payload.new;

                    if (driverData) {
                        offerToAdd = {
                            ...payload.new,
                            driver: {
                                id: driverData.id,
                                name: driverData.users?.full_name || 'Driver',
                                phone: driverData.users?.phone,
                                rating: driverData.rating || '5.0',
                                image: driverData.profile_photo_url,
                                car: driverData.vehicle_model,
                                plate: driverData.vehicle_plate,
                                color: driverData.vehicle_color,
                            }
                        };
                    }

                    setOffers((prev) => {
                        if (prev.some(o => o.id === offerToAdd.id)) return prev;
                        return [...prev, offerToAdd];
                    });
                }
            );

            unsubStatus = await realtimeClient.subscribe(
                { channel: 'trip:status', tripId },
                async (payload) => {
                    console.log('[SearchingDriver] Trip status updated:', payload.new?.status, 'driver_id:', payload.new?.driver_id);

                    if (payload.new?.status === 'accepted' && payload.new?.driver_id) {
                        // If it is a travel request, do NOT auto-navigate. 
                        // The user can navigate via the home screen card or the accept button.
                        if (trip?.is_travel_request) {
                            console.log('[SearchingDriver] Trip is travel request, skipping auto-navigation to DriverFound');
                            return;
                        }

                        console.log('[SearchingDriver] Trip accepted! Fetching driver details for driver:', payload.new.driver_id);
                        try {
                            const response = await apiRequest<{ driver: any }>(`/drivers/public/${payload.new.driver_id}?tripId=${tripId}`);
                            console.log('[SearchingDriver] Driver details fetched:', response.driver);
                            const driverData = response.driver;
                            if (driverData) {
                                navigation.replace('DriverFound', {
                                    tripId,
                                    driver: {
                                        id: driverData.id,
                                        name: driverData.users?.full_name || 'Driver',
                                        phone: driverData.users?.phone,
                                        rating: driverData.rating || '5.0',
                                        image: driverData.profile_photo_url,
                                        car: driverData.vehicle_model,
                                        plate: driverData.vehicle_plate,
                                        color: driverData.vehicle_color,
                                        lat: driverData.current_lat,
                                        lng: driverData.current_lng,
                                        eta: '5 min',
                                    },
                                });
                            }
                        } catch (e: any) {
                            console.error('[SearchingDriver] Failed to fetch driver details:', e.message || e);
                            // Still navigate to DriverFound even if fetch fails - the screen can load details itself
                            navigation.replace('DriverFound', { tripId });
                        }
                    }
                }
            );
        })();

        return () => {
            if (unsubOffers) unsubOffers();
            if (unsubStatus) unsubStatus();
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [tripId]);

    const handleAcceptOffer = async (offer: any) => {
        try {
            console.log('[SearchingDriver] Accepting offer:', offer.id);

            await apiRequest('/trips/accept-offer', {
                method: 'POST',
                body: JSON.stringify({
                    tripId,
                    offerId: offer.id,
                    driverId: offer.driver_id,
                    finalPrice: offer.offer_price || offer.offered_price || offer.price
                })
            });

            console.log('[SearchingDriver] Offer accepted successfully');

            // For travel requests, we disabled auto-navigation in the status listener, 
            // so we navigate manually here after the user explicitly accepts an offer.
            if (trip?.is_travel_request) {
                navigation.replace('DriverFound', { tripId });
            }
            // Navigation for normal trips will happen automatically via the status listener
        } catch (err: any) {
            console.error('[SearchingDriver] Error:', err);
            // Check if trip was already accepted by another driver
            if (err.status === 409 || err.message?.includes('already accepted')) {
                Alert.alert(
                    'Driver Already Selected',
                    'This trip has already been accepted by another driver.',
                    [
                        {
                            text: 'View Driver',
                            onPress: () => navigation.replace('DriverFound', { tripId })
                        }
                    ]
                );
            } else {
                Alert.alert('Error', 'Failed to accept offer. Please try again.');
            }
        }
    };

    const handleRejectOffer = async (offer: any) => {
        try {
            console.log('[SearchingDriver] Rejecting offer:', offer.id);

            await apiRequest(`/trip-offers/${offer.id}/reject`, { method: 'POST' });

            // Remove from local state
            setOffers((prev) => prev.filter((o) => o.id !== offer.id));

            console.log('[SearchingDriver] Offer rejected');
        } catch (err) {
            console.error('[SearchingDriver] Error:', err);
        }
    };

    const handleCancel = () => {
        Alert.alert(
            'Cancel Trip',
            'Are you sure you want to cancel this trip request?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            console.log('[SearchingDriver] Cancelling trip:', tripId);
                            await apiRequest(`/trips/${tripId}/cancel`, { method: 'POST' });

                            // Optional: Fetch updated data or just navigate back
                            const data = await apiRequest<{ trip: any }>(`/trips/${tripId}`);

                            if (data.trip) {
                                if (data.trip.is_travel_request) {
                                    // Go back to Intercity Screen
                                    navigation.replace('TravelRequest', {
                                        pickup: { address: data.trip.pickup_address, lat: data.trip.pickup_lat, lng: data.trip.pickup_lng },
                                        destination: { address: data.trip.dest_address, lat: data.trip.dest_lat, lng: data.trip.dest_lng }
                                    });
                                } else {
                                    // Navigate back to options with pre-filled addresses
                                    navigation.replace('TripOptions', {
                                        pickup: data.trip.pickup_address,
                                        destination: data.trip.dest_address,
                                        destinationCoordinates: [data.trip.dest_lng, data.trip.dest_lat]
                                    });
                                }
                            } else {
                                navigation.goBack();
                            }
                        } catch (err) {
                            console.error('[SearchingDriver] Cancel Error:', err);
                            // Even if error, likely want to leave this screen if user intends to cancel
                            navigation.goBack();
                        }
                    },
                },
            ]
        );
    };

    if (!trip) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.textSecondary }}>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Map View */}
            <View style={styles.mapContainer}>
                <MapView
                    key={`searching-driver-map-${isDark ? 'dark' : 'light'}`}
                    ref={mapRef}
                    style={[styles.map, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                    initialRegion={{
                        latitude: 31.2357,
                        longitude: 29.9511,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                    customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                    userInterfaceStyle={isDark ? 'dark' : 'light'}
                >
                    <MapTileLayer isDark={isDark} />

                    {trip && (
                        <>
                            <Marker coordinate={{ latitude: parseFloat(trip.pickup_lat), longitude: parseFloat(trip.pickup_lng) }}>
                                <View style={styles.pickupMarker}>
                                    <MapPin size={20} color="#fff" />
                                </View>
                            </Marker>
                            <Marker coordinate={{ latitude: parseFloat(trip.dest_lat), longitude: parseFloat(trip.dest_lng) }}>
                                <View style={styles.destMarker}>
                                    <MapPin size={20} color="#fff" />
                                </View>
                            </Marker>
                        </>
                    )}
                </MapView>
            </View>

            {/* Home Button for Travel Requests */}
            {trip?.is_travel_request && (
                <TouchableOpacity
                    style={[styles.homeButton, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
                    onPress={() => navigation.navigate('CustomerHome')}
                >
                    <NavigationIcon size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            )}
            {/* Close Button */}
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.surface, shadowColor: colors.shadow }]} onPress={handleCancel}>
                <X size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Bottom Card */}
            <View style={[styles.bottomCard, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <View style={styles.searchingContainer}>
                    <Animated.View
                        style={[
                            styles.pulseCircle,
                            {
                                transform: [{ scale: pulseAnim }],
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.searchIcon,
                            {
                                transform: [{ rotate: spin }],
                            },
                        ]}
                    >
                        <View style={[styles.iconInner, { backgroundColor: colors.surface }]}>
                            <Text style={styles.iconText}>🚗</Text>
                        </View>
                    </Animated.View>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>{t('findingYourDriver')}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {offers.length > 0
                        ? `${offers.length} ${t('driverOffers')}`
                        : t('searchingNearby')
                    }
                </Text>

                {/* Driver Offers */}
                {offers.length > 0 && (
                    <ScrollView style={styles.offersListContainer} showsVerticalScrollIndicator={false}>
                        {offers.map((offer, index) => (
                            <View key={offer.id || index} style={[styles.offerCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
                                {/* Header: Driver Info & Price */}
                                <View style={styles.offerHeader}>
                                    <View style={styles.driverInfo}>
                                        <View style={styles.driverAvatarContainer}>
                                            {offer.driver?.image ? (
                                                <Image
                                                    source={{ uri: offer.driver.image }}
                                                    style={styles.driverImage}
                                                />
                                            ) : (
                                                <View style={[styles.driverAvatarFallback, { backgroundColor: colors.surface3, borderColor: colors.border }]}>
                                                    <User size={24} color="#FFF" />
                                                </View>
                                            )}
                                            <View style={styles.ratingBadge}>
                                                <Star size={10} color="#FFF" fill="#FFF" />
                                                <Text style={styles.ratingTextSmall}>{offer.driver?.rating || '5.0'}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.driverDetails}>
                                            <Text style={[styles.driverName, { color: colors.textPrimary }]}>{offer.driver?.name || t('driver')}</Text>
                                            <View style={styles.carInfoRow}>
                                                <Car size={14} color={colors.textSecondary} />
                                                <Text style={[styles.carText, { color: colors.textSecondary }]}>
                                                    {offer.driver?.car || t('vehicle')}
                                                    {offer.driver?.color ? ` • ${offer.driver.color}` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={[styles.priceContainer, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#ECFDF5', borderColor: isDark ? 'rgba(52,211,153,0.45)' : '#A7F3D0' }]}>
                                        <Text style={[styles.priceLabel, { color: colors.success }]}>{t('offer')}</Text>
                                        <Text style={[styles.priceValue, { color: colors.success }]}>EGP {Math.round(offer.offer_price || offer.offered_price || offer.price)}</Text>
                                    </View>
                                </View>

                                {/* Vehicle Plate & Extras (Divider) */}
                                <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                                <View style={styles.offerExtras}>
                                    <View style={[styles.plateContainer, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                                        <Text style={[styles.plateLabel, { color: colors.textPrimary }]}>EGY</Text>
                                        <Text style={[styles.plateNumber, { color: colors.textSecondary }]}>{offer.driver?.plate || '---'}</Text>
                                    </View>
                                    <View style={[styles.etaContainer, { backgroundColor: colors.surfaceHighlight }]}>
                                        <Text style={[styles.etaText, { color: colors.info }]}>~ {offer.driver?.eta || '5 min'}</Text>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.offerActions}>
                                    <TouchableOpacity
                                        style={[styles.rejectButton, { backgroundColor: isDark ? 'rgba(248,113,113,0.14)' : '#FEF2F2', borderColor: colors.danger }]}
                                        onPress={() => handleRejectOffer(offer)}
                                        activeOpacity={0.7}
                                    >
                                        <X size={20} color={colors.danger} />
                                        <Text style={[styles.rejectButtonText, { color: colors.danger }]}>{t('reject')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.acceptButton}
                                        onPress={() => handleAcceptOffer(offer)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.acceptButtonText}>{t('acceptRide')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <View style={styles.tripDetails}>
                    <View style={styles.detailRow}>
                        <View style={styles.dot} />
                        <Text style={[styles.detailText, { color: colors.textPrimary }]} numberOfLines={1}>
                            {trip.pickup_address || 'Pickup location'}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
                        <Text style={[styles.detailText, { color: colors.textPrimary }]} numberOfLines={1}>
                            {trip.dest_address || 'Destination'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.danger }]} onPress={handleCancel}>
                    <Text style={[styles.cancelButtonText, { color: colors.danger }]}>Cancel Request</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        flex: 1,
    },
    pickupMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    destMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        zIndex: 50,
        top: 50,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        width: width,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 15,
        alignItems: 'center',
    },
    searchingContainer: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    pulseCircle: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: `${Colors.primary}20`,
    },
    searchIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    iconInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    offersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: `${Colors.success}15`,
        borderRadius: 20,
        marginBottom: 20,
    },
    offersText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.success,
    },
    tripDetails: {
        width: '100%',
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
        marginRight: 12,
    },
    detailText: {
        flex: 1,
        fontSize: 14,
        color: Colors.textPrimary,
    },
    cancelButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Driver Offer Styles
    offersListContainer: {
        width: '100%',
        maxHeight: 320,
        marginBottom: 16,
    },
    offerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    offerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    driverInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    driverAvatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    driverImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    driverAvatarFallback: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    ratingBadge: {
        position: 'absolute',
        bottom: -4,
        alignSelf: 'center',
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FFF',
    },
    ratingTextSmall: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    driverDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: 4,
        textAlign: 'left',
    },
    carInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    carText: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginLeft: 6,
    },
    priceContainer: {
        backgroundColor: '#ECFDF5', // Light Green
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'flex-end',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    priceLabel: {
        fontSize: 10,
        color: '#059669',
        fontWeight: '600',
        marginBottom: 0,
    },
    priceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#059669',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 12,
    },
    offerExtras: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    plateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    plateLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#1F2937',
        marginRight: 6,
        letterSpacing: 1,
    },
    plateNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#374151',
        letterSpacing: 2,
    },
    etaContainer: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    etaText: {
        fontSize: 12,
        color: '#2563EB',
        fontWeight: '600',
    },
    offerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    rejectButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#FEF2F2',
        paddingVertical: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    rejectButtonText: {
        color: '#DC2626',
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    acceptButton: {
        flex: 2,
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
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
    mapContainer: {
        flex: 1,
        width: '100%',
    }
});
