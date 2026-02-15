import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Dimensions, Animated, Modal, TouchableWithoutFeedback, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, I18nManager } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { ArrowLeft, Car, CloudLightning, CreditCard, Ticket, Clock, Star, BadgePercent, Wallet, X, MapPin } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import * as Location from 'expo-location';
import { getDirections, reverseGeocode } from '../../services/mapService';
import { apiRequest } from '../../services/backend';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text'; // Use Custom Text
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const { width, height } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

type TripOptionsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TripOptions'>;
type TripOptionsScreenRouteProp = RouteProp<RootStackParamList, 'TripOptions'>;

const RIDE_IMAGES: any = {
    saver: require('../../assets/images/saver.webp'),
    comfort: require('../../assets/images/comfort.webp'),
    vip: require('../../assets/images/vip.webp'),
    taxi: require('../../assets/images/taxi.webp'),
    scooter: require('../../assets/images/scooter.webp'),
};

const BASE_RIDES = [
    { id: 'saver', name: 'Saver', ratePerKm: 5, baseFooter: 10, etaMultiplier: 1.2, image: RIDE_IMAGES.saver, color: '#10B981', promo: 'Best Value' },
    { id: 'comfort', name: 'Comfort', ratePerKm: 7, baseFooter: 15, etaMultiplier: 1.0, image: RIDE_IMAGES.comfort, color: Colors.primary, promo: 'Recommended' },
    { id: 'vip', name: 'VIP', ratePerKm: 12, baseFooter: 25, etaMultiplier: 0.9, image: RIDE_IMAGES.vip, color: '#1e1e1e', promo: 'Premium Service' },
];

export default function TripOptionsScreen() {
    const navigation = useNavigation<TripOptionsScreenNavigationProp>();
    const route = useRoute<TripOptionsScreenRouteProp>();
    const { pickup, destination, destinationCoordinates, autoRequest, pickupCoordinates } = route.params;
    const { t, isRTL, language } = useLanguage();
    const { colors, spacing, radius, shadow, isDark } = useTheme();

    // RTL Layout Logic
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';
    const alignSelf = isRTL ? 'flex-end' : 'flex-start';
    const backButtonStyle = isSimulating ? { right: 20 } : { left: 20 };
    const iconMargin = isRTL ? { marginLeft: 12, marginRight: 0 } : { marginRight: 12, marginLeft: 0 };

    const [pickupAddress, setPickupAddress] = useState<string>(pickup);
    const [selectedRide, setSelectedRide] = useState('comfort');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Wallet'>('Cash');
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Route Data
    const [pickupCoords, setPickupCoords] = useState<{ latitude: number, longitude: number } | null>(null);
    const [destCoords, setDestCoords] = useState<{ latitude: number, longitude: number } | null>(null);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number, longitude: number }[]>([]);
    const [routeInfo, setRouteInfo] = useState<{ distance: number, duration: number } | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);
    const mapRef = useRef<MapView>(null);

    // Promo Logic
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

    // Animation
    const slideUp = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        Animated.timing(slideUp, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    // Auto-Request Logic
    useEffect(() => {
        if (autoRequest && routeInfo && !routeLoading && routeCoords.length > 0) {
            handleRequest();
        }
    }, [autoRequest, routeInfo, routeLoading, routeCoords]);

    // 1. Resolve Coords & Fetch Route
    useEffect(() => {
        const initRoute = async (retryCount = 0) => {
            setRouteLoading(true);
            setRouteError(null);
            setRouteCoords([]);
            setRouteInfo(null);
            setPickupCoords(null);
            setDestCoords(null);

            try {
                // 1. Get Pickup Coords
                let pCoords: { latitude: number; longitude: number } | null = null;

                if (pickupCoordinates) {
                    pCoords = { latitude: pickupCoordinates[1], longitude: pickupCoordinates[0] };
                } else if (pickup === 'Current Location' || pickup === t('currentLocation') || !pickup) {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                        pCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };

                        // Reverse Geocode
                        try {
                            const address = await reverseGeocode(loc.coords.latitude, loc.coords.longitude, language as any);
                            if (address) setPickupAddress(address);
                        } catch (e) {
                            console.log('Failed to reverse geocode current location', e);
                        }
                    }
                } else {
                    // Try to geocode selected pickup address. Never fallback to current location.
                    try {
                        const geocoded = await Location.geocodeAsync(pickup);
                        if (geocoded.length > 0) {
                            pCoords = { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude };
                            setPickupAddress(pickup);
                        } else {
                            throw new Error('PICKUP_GEOCODE_FAILED');
                        }
                    } catch (e) {
                        throw new Error('PICKUP_GEOCODE_FAILED');
                    }
                }
                if (!pCoords) {
                    throw new Error('PICKUP_GEOCODE_FAILED');
                }
                setPickupCoords(pCoords);

                // 2. Get Dest Coords
                let dCoords = { latitude: 0, longitude: 0 };
                if (destinationCoordinates) {
                    dCoords = { latitude: destinationCoordinates[1], longitude: destinationCoordinates[0] };
                    setDestCoords(dCoords);
                }

                // 3. Fetch Directions with timeout
                if (pCoords.latitude !== 0 && dCoords.latitude !== 0) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

                    try {
                        const routeData = await getDirections(
                            [pCoords.longitude, pCoords.latitude],
                            [dCoords.longitude, dCoords.latitude]
                        );
                        clearTimeout(timeoutId);

                        if (routeData) {
                            const points = routeData.geometry.coordinates.map((pt: number[]) => ({
                                latitude: pt[1],
                                longitude: pt[0]
                            }));
                            setRouteCoords(points);
                            setRouteInfo({
                                distance: routeData.distance / 1000,
                                duration: routeData.duration / 60
                            });

                            // Fit Bounds with delay for Android rendering
                            setTimeout(() => {
                                mapRef.current?.fitToCoordinates(points, {
                                    edgePadding: { top: 50, right: 50, bottom: height / 2, left: 50 },
                                    animated: true
                                });
                            }, 800);
                        } else {
                            throw new Error('No route data received');
                        }
                    } catch (dirError: any) {
                        clearTimeout(timeoutId);
                        if (retryCount < 2) {
                            console.log(`[TripOptions] Retrying route fetch (${retryCount + 1}/2)...`);
                            setTimeout(() => initRoute(retryCount + 1), 1000);
                            return;
                        }
                        throw dirError;
                    }
                }
            } catch (err: any) {
                console.error('[TripOptions] Route error:', err);
                if (err?.message === 'PICKUP_GEOCODE_FAILED') {
                    setPickupAddress(pickup);
                    setRouteError('Could not resolve pickup location. Please reselect pickup.');
                } else {
                    setRouteError('Failed to calculate route. Please try again.');
                }
            } finally {
                setRouteLoading(false);
            }
        };

        initRoute();
    }, [pickup, pickupCoordinates, destination, destinationCoordinates, language, t]);


    const [pricingConfig, setPricingConfig] = useState<any[]>([]);

    // 0. Fetch Pricing Configuration (Runs when screen is focused)
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchPricing = async () => {
                console.log("Fetching pricing settings...");
                try {
                    const data = await apiRequest<{ pricing: any[] }>('/pricing/settings', { auth: false });
                    if (data.pricing && isActive) {
                        console.log("Pricing loaded:", data.pricing);
                        setPricingConfig(data.pricing);
                    }
                } catch (error) {
                    console.error("Error fetching pricing:", error);
                }
            };

            fetchPricing();

            return () => { isActive = false; };
        }, [])
    );

    const [promoDiscount, setPromoDiscount] = useState<number>(0);
    const [promoMaxDiscount, setPromoMaxDiscount] = useState<number | null>(null);

    // Calculated Rides with Discount
    const ridesData = useMemo(() => {
        const dist = routeInfo ? routeInfo.distance : 5; // km
        const dur = routeInfo ? routeInfo.duration : 10; // min

        // Localized Definitions
        const Definitions = [
            { id: 'saver', name: t('rideSaver') || 'Saver', image: RIDE_IMAGES.saver, color: '#10B981', promo: t('bestValue') || 'Best Value', etaMult: 1.2 },
            { id: 'comfort', name: t('rideComfort') || 'Comfort', image: RIDE_IMAGES.comfort, color: colors.primary, promo: t('recommended') || 'Recommended', etaMult: 1.0 },
            { id: 'vip', name: t('rideVIP') || 'VIP', image: RIDE_IMAGES.vip, color: colors.textPrimary, promo: null, etaMult: 1.0 },
            { id: 'scooter', name: t('rideScooter') || 'Scooter', image: RIDE_IMAGES.scooter, color: '#F59E0B', promo: t('fastest') || 'Fastest', etaMult: 0.8 },
            { id: 'taxi', name: t('rideTaxi') || 'Taxi', image: RIDE_IMAGES.taxi, color: '#FBBF24', promo: null, etaMult: 1.1 },
        ];

        // Filter definitions based on what we have in pricingConfig
        return Definitions.map(def => {
            const config = pricingConfig.find(p => p.service_tier === def.id);

            const base = config ? config.base_fare : 10;
            const perKm = config ? config.per_km_rate : 3;
            const perMin = config ? config.per_min_rate : 0.5;
            const minPrice = config ? config.minimum_trip_price : 15;

            let rawPrice = base + (dist * perKm) + (dur * perMin);
            if (rawPrice < minPrice) rawPrice = minPrice;

            let finalPrice = rawPrice;
            const eta = Math.ceil(dur * def.etaMult);

            // Apply Promo
            let promoText = def.promo;
            let oldPrice = null;

            if (appliedPromo) {
                oldPrice = parseFloat(finalPrice.toFixed(2));

                // Calculate Discount Amount
                let discountAmount = finalPrice * (promoDiscount / 100);

                // Apply Max Cap if exists
                if (promoMaxDiscount && discountAmount > promoMaxDiscount) {
                    discountAmount = promoMaxDiscount;
                }

                finalPrice = finalPrice - discountAmount;
                promoText = `${promoDiscount}% ${t('off') || 'OFF'}`;
                if (promoMaxDiscount) promoText += ` (${t('max') || 'Max'} ${promoMaxDiscount} ${t('currency') || 'EGP'})`;
            }

            return {
                ...def,
                price: parseFloat(finalPrice.toFixed(2)),
                oldPrice: oldPrice,
                eta: `${eta} ${t('min') || 'min'}`,
                promo: promoText,
                isValid: !!config
            };
        }).filter(r => r.isValid || pricingConfig.length === 0);
    }, [appliedPromo, routeInfo, pricingConfig, promoDiscount, promoMaxDiscount, t]);




    const handleApplyPromo = async () => {
        if (promoInput.trim().length === 0) return;

        const code = promoInput.trim().toUpperCase();

        try {
            const data = await apiRequest<{ promo: any }>(`/pricing/promo?code=${encodeURIComponent(code)}`, { auth: false });

            // Success
            // Success
            setAppliedPromo(code);
            setPromoDiscount(data.promo.discount_percent);
            setPromoMaxDiscount(data.promo.discount_max);
            setShowPromoModal(false);
            Alert.alert('Success', `Promo applied! You get ${data.promo.discount_percent}% off.`);

        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to verify promo code.');
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoDiscount(0);
        setPromoMaxDiscount(null);
        setPromoInput('');
    };

    const [requesting, setRequesting] = useState(false);

    // ...
    // Auto-load selected promo from storage
    useEffect(() => {
        const loadSelectedPromo = async () => {
            const storedPromo = await AsyncStorage.getItem('selected_promo');
            if (storedPromo) {
                const promo = JSON.parse(storedPromo);
                // Apply it
                setAppliedPromo(promo.code);
                setPromoDiscount(promo.discount_percent);
                setPromoMaxDiscount(promo.discount_max);
                setPromoInput(promo.code); // Sync input
            }
        };
        loadSelectedPromo();
    }, []);



    // ...

    const handleRequest = async () => {
        if (!pickupCoords || !destCoords || !routeInfo) {
            Alert.alert('Error', 'Route not calculated yet.');
            return;
        }

        setRequesting(true);

        try {
            const sessionData = await AsyncStorage.getItem('userSession');
            if (!sessionData) {
                Alert.alert('Auth Error', 'Please log in again.');
                return;
            }

            const { user } = JSON.parse(sessionData);
            const selectedRideData = ridesData.find(r => r.id === selectedRide);

            if (!selectedRideData) return;

            // Creating Trip
            const payload = {
                customer_id: user.id,
                pickup_lat: pickupCoords.latitude,
                pickup_lng: pickupCoords.longitude,
                dest_lat: destCoords.latitude,
                dest_lng: destCoords.longitude,
                pickup_address: pickupAddress || pickup,
                dest_address: destination,
                price: selectedRideData.price,
                distance: routeInfo.distance,
                duration: routeInfo.duration,
                car_type: selectedRide,
                payment_method: paymentMethod.toLowerCase(),
                promo_code: appliedPromo // Send the promo code!
            };

            const response = await apiRequest<{ trip: any }>('/trips/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.trip) {
                // Clear the used promo from storage
                await AsyncStorage.removeItem('selected_promo');
                navigation.navigate('SearchingDriver', { tripId: response.trip.id });
            }

        } catch (error: any) {
            console.error('Request Ride Error', error);
            const serverMsg = error.response?.data?.error || error.message || 'Unknown error';
            Alert.alert('Request Failed', serverMsg);
        } finally {
            setRequesting(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* --- REAL MAP LAYER --- */}
            <View style={styles.mapLayer}>
                <MapView
                    key={`trip-options-map-${isDark ? 'dark' : 'light'}`}
                    ref={mapRef}
                    style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                    initialRegion={{
                        latitude: 30.0444, longitude: 31.2357,
                        latitudeDelta: 0.1, longitudeDelta: 0.1
                    }}
                    mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                    customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                    userInterfaceStyle={isDark ? 'dark' : 'light'}
                >

                    <MapTileLayer isDark={isDark} />

                    {pickupCoords && (
                        <Marker coordinate={pickupCoords} title="Pickup">
                            <View style={styles.customMarkerPickup}>
                                <View style={styles.dotPickupInner} />
                            </View>
                        </Marker>
                    )}
                    {destCoords && (
                        <Marker coordinate={destCoords} title="Destination">
                            <View style={styles.customMarkerDest}>
                                <MapPin size={24} color="#EF4444" fill="#EF4444" />
                            </View>
                        </Marker>
                    )}

                    {routeCoords.length > 0 && (
                        <Polyline
                            coordinates={routeCoords}
                            strokeWidth={4}
                            strokeColor="#1e1e1e"
                        />
                    )}
                </MapView>

                <TouchableOpacity
                    style={[styles.backButton, backButtonStyle]}
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'CustomerHome' }],
                            });
                        }
                    }}
                >
                    <ArrowLeft size={24} color="#000" strokeWidth={3} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>
            </View>

            {/* --- BOTTOM SHEET --- */}
            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideUp }], backgroundColor: colors.surface, shadowColor: colors.shadow }]}>

                {/* Route Header */}
                {/* Route Header */}
                <View style={[styles.routeInfo, { flexDirection: 'column' }]}>
                    <View style={[styles.routeNode, { flexDirection }]}>
                        <View style={[styles.dot, { backgroundColor: '#10B981' }, iconMargin]} />
                        <Text variant="body" weight="bold" style={[styles.addressText, { textAlign, color: colors.textPrimary }]} numberOfLines={1}>{pickupAddress || t('currentLocation')}</Text>
                    </View>
                    <View style={[styles.verticalLineWrapper, { alignItems: isRTL ? 'flex-end' : 'flex-start', paddingRight: isRTL ? 7.5 : 0, paddingLeft: isRTL ? 0 : 4.5 }]}>
                        <View style={[styles.verticalLine, { backgroundColor: colors.border }]} />
                    </View>
                    <View style={[styles.routeNode, { flexDirection }]}>
                        <View style={[styles.dot, { backgroundColor: '#EF4444' }, iconMargin]} />
                        <Text variant="body" weight="bold" style={[styles.addressText, { textAlign, color: colors.textPrimary }]} numberOfLines={1}>{destination}</Text>
                    </View>
                </View>

                {routeInfo && (
                    <View style={[styles.tripStats, { backgroundColor: colors.surfaceHighlight }]}>
                        <Text variant="caption" style={[styles.tripStatsText, { color: colors.textSecondary }]}>{routeInfo.distance.toFixed(1)} {t('km') || 'km'}  •  {Math.ceil(routeInfo.duration)} {t('min') || 'min'}</Text>
                    </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text variant="h3" style={[styles.sectionTitle, { textAlign, color: colors.textPrimary }]}>{t('chooseRide') || 'Choose a ride'}</Text>

                {/* Ride Options (Vertical List) */}
                <ScrollView
                    style={styles.ridesList}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {ridesData.map((ride) => (
                        <TouchableOpacity
                            key={ride.id}
                            style={[
                                styles.rideCard,
                                { flexDirection, backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow },
                                selectedRide === ride.id && { borderColor: colors.primary, borderWidth: 2 }
                            ]}
                            onPress={() => setSelectedRide(ride.id)}
                            activeOpacity={0.9}
                        >
                            {/* Selection Indicator */}
                            <View style={[
                                {
                                    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                                    alignItems: 'center', justifyContent: 'center',
                                    borderColor: selectedRide === ride.id ? colors.primary : colors.border
                                },
                                isRTL ? { marginLeft: 12 } : { marginRight: 12 }
                            ]}>
                                {selectedRide === ride.id && (
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                                )}
                            </View>

                            {/* Icon Section */}
                            <View style={[styles.rideIconWrapper, isRTL ? { marginLeft: 8 } : { marginRight: 8 }]}>
                                <Image source={ride.image} style={styles.rideImage} resizeMode="contain" />
                            </View>

                            {/* Info Section */}
                            <View style={[styles.rideInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                                <View style={{ flexDirection: flexDirection, alignItems: 'center', gap: 6 }}>
                                    <Text variant="body" weight="bold" style={{ color: colors.textPrimary, fontSize: 18 }}>{ride.name}</Text>
                                    <View style={[styles.personRow, { backgroundColor: colors.surfaceHighlight }]}>
                                        <Text variant="caption" style={{ color: colors.textSecondary }}>4</Text>
                                        <Car size={10} color={colors.textSecondary} />
                                    </View>
                                </View>
                                <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{ride.eta}</Text>
                                {ride.promo && (
                                    <View style={[styles.promoTag, { backgroundColor: isDark ? 'rgba(6, 78, 59, 0.7)' : '#DCFCE7' }]}>
                                        <Text variant="caption" weight="bold" style={{ color: isDark ? '#34D399' : '#166534', fontSize: 10 }}>{ride.promo}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Price Section */}
                            <View style={[styles.priceSection, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
                                <View style={{ flexDirection: flexDirection, alignItems: 'baseline' }}>
                                    <Text variant="caption" weight="bold" style={{ color: colors.textPrimary, marginRight: 2, fontSize: 12 }}>{t('currency') || 'EGP'}</Text>
                                    <Text variant="h3" style={{ color: colors.textPrimary }}>{ride.price.toFixed(2)}</Text>
                                </View>
                                {ride.oldPrice && (
                                    <Text variant="caption" style={{ color: colors.textMuted, textDecorationLine: 'line-through' }}>{t('currency') || 'EGP'} {ride.oldPrice.toFixed(2)}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Footer Action */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <View style={[styles.paymentRow, { flexDirection }]}>
                        <TouchableOpacity
                            style={[styles.paymentSelect, { flexDirection }]}
                            onPress={() => setShowPaymentModal(true)}
                        >
                            {paymentMethod === 'Cash' ? (
                                <CreditCard size={20} color={colors.primary} />
                            ) : (
                                <Wallet size={20} color={colors.primary} />
                            )}
                            <Text variant="body" weight="bold" style={{ color: colors.textPrimary, marginLeft: 8 }}>{paymentMethod === 'Cash' ? (t('cash') || 'Cash') : (t('wallet') || 'Wallet')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.promoSelect, appliedPromo ? { backgroundColor: isDark ? 'rgba(6, 78, 59, 0.5)' : '#DCFCE7' } : null, { flexDirection }]}
                            onPress={() => setShowPromoModal(true)}
                        >
                            <BadgePercent size={18} color={appliedPromo ? (isDark ? '#34D399' : '#166534') : "#F97316"} />
                            <Text variant="body" weight="bold" style={[styles.promoLinkText, { color: appliedPromo ? (isDark ? '#34D399' : '#166534') : colors.primary, marginLeft: 8 }]}>
                                {appliedPromo ? appliedPromo : (t('promoCode') || 'Promo Code')}
                            </Text>
                            {appliedPromo && (
                                <TouchableOpacity onPress={handleRemovePromo} style={{ marginLeft: 4 }}>
                                    <X size={14} color={isDark ? '#34D399' : '#166534'} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.requestButton, requesting && { opacity: 0.8 }]}
                        onPress={handleRequest}
                        disabled={requesting}
                    >
                        <LinearGradient
                            colors={[colors.primary, '#1D4ED8']}
                            style={styles.gradientBtn}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        >
                            {requesting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text variant="body" weight="bold" style={{ color: '#fff', fontSize: 18 }}>{t('select') || 'Select'} {ridesData.find(r => r.id === selectedRide)?.name}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

            </Animated.View>

            {/* Payment Selection Modal */}
            <Modal
                visible={showPaymentModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowPaymentModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                                <Text variant="h3" style={{ textAlign, marginBottom: 8, color: colors.textPrimary }}>{t('selectPaymentMethod') || 'Select Payment Method'}</Text>

                                <TouchableOpacity
                                    style={[styles.paymentOption, paymentMethod === 'Cash' && { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }, { flexDirection, borderColor: colors.border }]}
                                    onPress={() => { setPaymentMethod('Cash'); setShowPaymentModal(false); }}
                                >
                                    <View style={[styles.optionIcon, iconMargin]}>
                                        <CreditCard size={24} color={colors.textPrimary} />
                                    </View>
                                    <Text variant="body" style={{ textAlign, color: colors.textPrimary, flex: 1 }}>{t('cash') || 'Cash'}</Text>
                                    {paymentMethod === 'Cash' && <View style={[styles.selectedDot, { backgroundColor: colors.primary }]} />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.paymentOption, paymentMethod === 'Wallet' && { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }, { flexDirection, borderColor: colors.border }]}
                                    onPress={() => { setPaymentMethod('Wallet'); setShowPaymentModal(false); }}
                                >
                                    <View style={[styles.optionIcon, iconMargin]}>
                                        <Wallet size={24} color={colors.textPrimary} />
                                    </View>
                                    <Text variant="body" style={{ textAlign, color: colors.textPrimary, flex: 1 }}>{t('wallet') || 'Wallet'}</Text>
                                    {paymentMethod === 'Wallet' && <View style={[styles.selectedDot, { backgroundColor: colors.primary }]} />}
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Promo Code Modal */}
            <Modal
                visible={showPromoModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPromoModal(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <TouchableWithoutFeedback onPress={() => setShowPromoModal(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: colors.surface }]}>
                                    <Text variant="h3" style={{ textAlign, color: colors.textPrimary }}>{t('enterPromoCode') || "Enter Promo Code"}</Text>
                                    <Text variant="body" style={{ textAlign, color: colors.textSecondary, marginBottom: 20 }}>{t('promoSubtitle') || "Have a discount code? Enter it below."}</Text>

                                    <Input
                                        placeholder={t('promoPlaceholder') || "e.g. SMART50"}
                                        value={promoInput}
                                        onChangeText={setPromoInput}
                                        autoCapitalize="characters"
                                        style={{ textAlign, marginBottom: 16 }}
                                    />

                                    <TouchableOpacity style={[styles.applyButton, { backgroundColor: colors.primary }]} onPress={handleApplyPromo}>
                                        <Text variant="body" weight="bold" style={{ color: '#fff' }}>{t('applyCode') || "Apply Code"}</Text>
                                    </TouchableOpacity>

                                    {/* Available Promos List */}
                                    <View style={{ width: '100%', marginTop: 16 }}>
                                        <Text variant="caption" weight="bold" style={{ color: colors.textSecondary, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>{t('availablePromotions') || "Available Promotions"}</Text>
                                        <PromoList
                                            onSelect={(code) => {
                                                setPromoInput(code);
                                            }}
                                            colors={colors}
                                        />
                                    </View>

                                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPromoModal(false)}>
                                        <Text variant="body" style={{ color: colors.textMuted }}>{t('close') || "Close"}</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// Sub-component to fetch and list promos
const PromoList = ({ onSelect, colors }: { onSelect: (code: string) => void, colors: any }) => {
    const [promos, setPromos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await apiRequest<{ promos: any[] }>('/pricing/available', { auth: false }); // auth false because promos might be public? Actually backend allows user info
                if (data.promos) setPromos(data.promos);
            } catch (e) {
                console.log("Failed to load promos in modal", e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    if (loading) return <ActivityIndicator color={colors.primary} />;

    if (promos.length === 0) return <Text variant="caption" style={{ color: colors.textSecondary }}>No active promotions found.</Text>;

    return (
        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
            {promos.map(p => (
                <TouchableOpacity
                    key={p.id}
                    style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 12, backgroundColor: colors.surfaceHighlight, borderRadius: 8, marginBottom: 8
                    }}
                    onPress={() => onSelect(p.code)}
                >
                    <View>
                        <Text variant="body" weight="bold" style={{ color: colors.primary }}>{p.code}</Text>
                        <Text variant="caption" style={{ color: colors.textSecondary }}>{p.discount_percent}% OFF</Text>
                    </View>
                    <Ticket size={16} color={colors.primary} />
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    // Map & Background
    mapLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.5, backgroundColor: '#EFF6FF' },
    mapBackground: { flex: 1, backgroundColor: '#EEF2FF' },
    street: { position: 'absolute', backgroundColor: '#fff', opacity: 0.5 },
    backButton: { position: 'absolute', top: 60, backgroundColor: '#fff', padding: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, elevation: 5 }, // Left/Right handled dynamically

    // Fake Route Line
    routeLineContainer: { position: 'absolute', top: '30%', left: '20%', width: '60%', height: 100 },
    routeLine: { position: 'absolute', top: 10, left: 10, width: 2, height: 100, backgroundColor: '#1e1e1e', opacity: 0.2, transform: [{ rotate: '45deg' }] }, // Abstract line
    routeDotPickup: { position: 'absolute', top: 0, left: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },
    routeDotDropoff: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },


    // Bottom Sheet
    bottomSheet: {
        position: 'absolute', bottom: 0, width: width, height: height * 0.65,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 24, paddingHorizontal: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20
    },

    // Route Info Header
    routeInfo: { marginBottom: 16 },
    routeNode: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    addressText: { fontSize: 16, fontWeight: '600', color: '#1e1e1e', flex: 1 },
    verticalLineWrapper: { paddingLeft: 4.5, height: 16 }, // Center line with dot
    verticalLine: { width: 1, height: '100%', backgroundColor: '#E5E7EB' },

    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e1e1e', marginBottom: 16 },

    // Ride Cards
    ridesList: { flex: 1 },
    rideCard: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 16, paddingHorizontal: 16,
        borderRadius: 16, marginBottom: 12,
        borderWidth: 1.5, borderColor: '#F3F4F6', // Removed backgroundColor: '#fff' to rely on theme
    },
    rideCardSelected: { borderColor: Colors.primary, backgroundColor: '#F0F9FF' },

    rideIconWrapper: { width: 110, height: 75, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: 'transparent' },
    rideImage: { width: '100%', height: '100%', backgroundColor: 'transparent' },

    rideInfo: { flex: 1 },
    rideName: { fontSize: 18, fontWeight: 'bold', color: '#1e1e1e' },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F3F4F6', paddingHorizontal: 4, borderRadius: 4 },
    personText: { fontSize: 10, color: '#6B7280' },
    rideEta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    promoTag: { marginTop: 4, backgroundColor: '#DCFCE7', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    promoText: { color: '#166534', fontSize: 10, fontWeight: 'bold' },

    priceSection: { alignItems: 'flex-end' },
    currency: { fontSize: 12, fontWeight: '600', color: '#1e1e1e', marginRight: 2 },
    price: { fontSize: 18, fontWeight: 'bold', color: '#1e1e1e' },
    oldPrice: { fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through' },

    // Footer
    footer: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16, paddingBottom: 20 },
    paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    paymentSelect: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    paymentText: { fontSize: 16, fontWeight: '600', color: '#1e1e1e' },
    promoSelect: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    promoLinkText: { fontSize: 16, fontWeight: '600', color: Colors.primary },

    requestButton: { borderRadius: 16, overflow: 'hidden' },
    gradientBtn: { height: 56, alignItems: 'center', justifyContent: 'center' },
    requestButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: width * 0.85, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#1e1e1e' },
    modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, textAlign: 'center' },

    paymentOption: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    paymentOptionSelected: { backgroundColor: '#F9FAFB' },
    optionIcon: { marginRight: 16 },
    optionText: { fontSize: 18, fontWeight: '500', color: '#1e1e1e', flex: 1 },
    selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

    promoInput: { width: '100%', height: 50, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#1e1e1e', marginBottom: 16, backgroundColor: '#F9FAFB' },
    applyButton: { width: '100%', backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    applyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelButton: { padding: 8 },
    cancelButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '500' },

    // Markers
    customMarkerPickup: { width: 30, height: 30, backgroundColor: '#fff', borderRadius: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
    dotPickupInner: { width: 14, height: 14, backgroundColor: '#10B981', borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
    customMarkerDest: { alignItems: 'center', justifyContent: 'center' },

    // Stats
    tripStats: { alignSelf: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 12 },
    tripStatsText: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
