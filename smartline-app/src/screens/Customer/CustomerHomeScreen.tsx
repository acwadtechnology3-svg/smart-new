import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Animated, I18nManager, PanResponder, ScrollView, Platform, Image, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Scan, ShieldCheck, Search, MapPin, Gift, CarFront, Navigation } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import MapView from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import * as Location from 'expo-location';
import { RootStackParamList } from '../../types/navigation';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import PopupNotification from '../../components/PopupNotification';
import SideMenu from '../../components/SideMenu';
import { apiRequest } from '../../services/backend';
import { useLanguage } from '../../context/LanguageContext';
import ChatBotButton from '../../components/ChatBot/ChatBotButton';
import ChatBotModal from '../../components/ChatBot/ChatBotModal';
import { getActiveBanners, PromoBanner } from '../../services/bannerService';

type CustomerHomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CustomerHome'>;

const { width, height } = Dimensions.get('window');

// Default to Cairo if location not yet found
const DEFAULT_REGION = {
    latitude: 30.0444,
    longitude: 31.2357,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

const BANNER_HEIGHT = 160;
const SNAP_OPEN = 0;
const SNAP_DEFAULT = BANNER_HEIGHT;
const SNAP_CLOSED = 380;

const PROMO_BANNERS = [
    { id: 1, title: 'Summer Sale', sub: '50% off your first ride', colors: ['#4F46E5', '#818CF8'] },
    { id: 2, title: 'Refer & Earn', sub: 'Get EGP 50 for every friend', colors: ['#10B981', '#34D399'] },
    { id: 3, title: 'Safe Rides', sub: 'Verified drivers only', colors: ['#F59E0B', '#FBBF24'] },
];

export default function CustomerHomeScreen() {
    const navigation = useNavigation<CustomerHomeScreenNavigationProp>();
    const { t, isRTL } = useLanguage();
    const { colors, spacing, radius, shadow, isDark } = useTheme();
    const [isSideMenuVisible, setSideMenuVisible] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [currentAddress, setCurrentAddress] = useState<{ title: string, subtitle: string } | null>(null);
    const [isChatBotVisible, setChatBotVisible] = useState(false);
    const [activeTravelRequestId, setActiveTravelRequestId] = useState<string | null>(null);
    const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([]);
    const [bannersLoading, setBannersLoading] = useState(true);

    const mapRef = useRef<MapView>(null);

    // Draggable Sheet Logic
    const pan = useRef(new Animated.Value(SNAP_DEFAULT)).current;

    // Track animated value for logic
    const panValue = useRef(SNAP_DEFAULT);

    useEffect(() => {
        const id = pan.addListener(({ value }) => {
            panValue.current = value;
        });
        return () => pan.removeListener(id);
    }, []);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Determine if vertical drag is dominant and significant
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: () => {
                pan.setOffset(panValue.current);
                pan.setValue(0);
            },
            onPanResponderMove: Animated.event(
                [null, { dy: pan }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gestureState) => {
                pan.flattenOffset();

                // Snap Logic
                let target = SNAP_DEFAULT;
                const currentY = panValue.current;

                if (gestureState.dy < -50 || (gestureState.vy < -0.5 && currentY < SNAP_DEFAULT)) {
                    target = SNAP_OPEN;
                } else if (gestureState.dy > 50 || (gestureState.vy > 0.5 && currentY > SNAP_DEFAULT)) {
                    if (currentY > SNAP_CLOSED - 100) target = SNAP_CLOSED;
                    else target = SNAP_DEFAULT;
                } else {
                    // Snap to closest
                    const distOpen = Math.abs(currentY - SNAP_OPEN);
                    const distDefault = Math.abs(currentY - SNAP_DEFAULT);
                    const distClosed = Math.abs(currentY - SNAP_CLOSED);

                    if (distOpen < distDefault && distOpen < distClosed) target = SNAP_OPEN;
                    else if (distClosed < distDefault) target = SNAP_CLOSED;
                    else target = SNAP_DEFAULT;
                }

                // Boundary checks
                if (target === SNAP_OPEN && currentY > 50) target = SNAP_DEFAULT;

                Animated.spring(pan, {
                    toValue: target,
                    useNativeDriver: false,
                    bounciness: 4
                }).start();
            }
        })
    ).current;

    useFocusEffect(
        React.useCallback(() => {
            const checkActiveTrip = async () => {
                try {
                    const response = await apiRequest<{ trip: any }>('/trips/active');
                    if (response.trip) {
                        const activeTrip = response.trip;
                        if (activeTrip.is_travel_request) {
                            setActiveTravelRequestId(activeTrip.id);
                        } else {
                            setActiveTravelRequestId(null);
                            if (activeTrip.status === 'requested') {
                                navigation.navigate('SearchingDriver', { tripId: activeTrip.id });
                            } else if (activeTrip.status === 'accepted' || activeTrip.status === 'arrived') {
                                navigation.navigate('DriverFound', { tripId: activeTrip.id, driver: null });
                            } else if (activeTrip.status === 'started') {
                                navigation.navigate('OnTrip', { tripId: activeTrip.id });
                            }
                        }
                    } else {
                        setActiveTravelRequestId(null);
                    }
                } catch (e: any) {
                    if (e.status !== 404) console.log("Error checking active trip", e);
                    setActiveTravelRequestId(null);
                }
            };
            checkActiveTrip();
        }, [navigation])
    );

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);

            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
                if (reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    setCurrentAddress({
                        title: addr.street || addr.name || addr.district || "Current Location",
                        subtitle: `${addr.city || ''} ${addr.region || ''}`.trim() || "Locating..."
                    });
                }
            } catch (error) {
                console.log("Error fetching address:", error);
            }
        })();
    }, []);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                setBannersLoading(true);
                const { banners } = await getActiveBanners('customer');
                setPromoBanners(banners);
            } catch (error) {
                console.log('Error fetching banners:', error);
            } finally {
                setBannersLoading(false);
            }
        };
        fetchBanners();
    }, []);

    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';
    const leadingStyle = isSimulating ? { right: 20 } : { left: 20 };
    const trailingStyle = isSimulating ? { left: 20 } : { right: 20 };

    const handleRecenter = async () => {
        try {
            const currentLoc = await Location.getCurrentPositionAsync({});
            setLocation(currentLoc);
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: currentLoc.coords.latitude,
                    longitude: currentLoc.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
            }
        } catch (error) {
            console.log("Error getting location for recenter", error);
        }
    };

    const handleWhereToPress = () => {
        navigation.navigate('SearchLocation');
    };

    const handleBannerPress = async (banner: PromoBanner) => {
        try {
            switch (banner.action_type) {
                case 'link':
                    if (banner.action_value) {
                        const supported = await Linking.canOpenURL(banner.action_value);
                        if (supported) {
                            await Linking.openURL(banner.action_value);
                        } else {
                            Alert.alert('Error', 'Cannot open this link');
                        }
                    }
                    break;
                case 'screen':
                    if (banner.action_value) {
                        const screenName = banner.action_value;
                        if (screenName === 'InviteFriends') {
                            navigation.navigate('InviteFriends');
                        } else if (screenName === 'Wallet') {
                            navigation.navigate('Wallet');
                        } else if (screenName === 'Support') {
                            navigation.navigate('Help');
                        } else if (screenName === 'Profile') {
                            navigation.navigate('Profile');
                        } else {
                            console.log('Unknown screen:', screenName);
                        }
                    }
                    break;
                case 'refer':
                    navigation.navigate('InviteFriends');
                    break;
            }
        } catch (error) {
            console.log('Error handling banner press:', error);
            Alert.alert('Error', 'Failed to perform action');
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.mapLayer}>
                <MapView
                    key={`customer-home-map-${isDark ? 'dark' : 'light'}`}
                    ref={mapRef}
                    style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                    initialRegion={location ? {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    } : DEFAULT_REGION}
                    showsUserLocation={true}
                    mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                    customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                    userInterfaceStyle={isDark ? 'dark' : 'light'}
                >
                    <MapTileLayer isDark={isDark} />
                </MapView>
            </View>

            <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
                <View style={[styles.header, { flexDirection }]}>
                    <TouchableOpacity style={[styles.circleButton, { backgroundColor: colors.surface, shadowColor: colors.shadow }]} onPress={() => setSideMenuVisible(true)}>
                        <Menu color={colors.textPrimary} size={24} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <View style={[styles.locationHeader, { backgroundColor: isDark ? 'rgba(31,41,55,0.9)' : 'rgba(255,255,255,0.9)' }]}>
                        <Text variant="h3" style={{ color: colors.textPrimary, fontSize: 16 }}>{currentAddress?.title || t('currentLocation')}</Text>
                        <Text variant="caption" style={{ color: colors.textSecondary, fontSize: 10 }}>{currentAddress?.subtitle || t('locating')}</Text>
                    </View>
                    <TouchableOpacity style={[styles.circleButton, { backgroundColor: colors.surface, shadowColor: colors.shadow }]} onPress={() => { }}>
                        <Scan color={colors.textPrimary} size={24} strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>

                {/* Floating UI Elements synchronized with panel */}
                <Animated.View style={[styles.floatingUI, { transform: [{ translateY: pan }] }]} pointerEvents="box-none">
                    <TouchableOpacity
                        style={[styles.recenterButton, trailingStyle, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
                        onPress={handleRecenter}
                    >
                        <Navigation color={colors.textPrimary} size={24} fill={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.safetyPill, leadingStyle, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.surface, shadowColor: colors.shadow }]} onPress={() => navigation.navigate('Safety', {})}>
                        <View style={[styles.shieldIconBg, { backgroundColor: colors.primary }]}>
                            <ShieldCheck color="#fff" size={14} fill="#fff" />
                        </View>
                        <Text variant="caption" weight="bold" style={{ color: colors.textPrimary, marginLeft: 8 }}>{t('safetyCenter')}</Text>
                    </TouchableOpacity>

                    {/* ChatBot Button Fixed above Shield */}
                    <ChatBotButton
                        onPress={() => setChatBotVisible(true)}
                        disableDrag
                        style={[{ right: 20 }, { bottom: 56, position: 'absolute' }]}
                    />
                </Animated.View>

                {/* Draggable Bottom Sheet */}
                <Animated.View
                    style={[styles.bottomSheet, { transform: [{ translateY: pan }], backgroundColor: colors.surface, shadowColor: colors.shadow }]}
                    {...panResponder.panHandlers}
                >
                    <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

                    <TouchableOpacity style={[styles.searchCard, { flexDirection, marginBottom: 8, backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={handleWhereToPress} activeOpacity={0.9}>
                        <View style={styles.searchIconBubble} />
                        <Text variant="h2" style={{ textAlign, color: colors.textPrimary }}>{t('whereTo')}</Text>
                    </TouchableOpacity>

                    {/* NEW: Banners Section (Moved under Search as requested) */}
                    <View style={[styles.bannerContainer, { marginTop: 0, marginBottom: 16 }]}>
                        {bannersLoading ? (
                            <View style={[styles.bannerLoading, { backgroundColor: colors.surface2 }]}>
                                <Text variant="caption" style={{ color: colors.textMuted }}>Loading...</Text>
                            </View>
                        ) : promoBanners.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerScroll}>
                                {promoBanners.map((banner) => (
                                    <TouchableOpacity
                                        key={banner.id}
                                        style={styles.bannerItem}
                                        onPress={() => handleBannerPress(banner)}
                                    >
                                        {banner.image_url ? (
                                            <View style={styles.bannerImageContainer}>
                                                <Image source={{ uri: banner.image_url }} style={styles.bannerImage} resizeMode="contain" />
                                            </View>
                                        ) : (
                                            <LinearGradient
                                                colors={['#4F46E5', '#818CF8']}
                                                style={styles.bannerGradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                            />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : null}
                    </View>

                    <View style={[styles.gridContainer, { flexDirection }]}>
                        {/* Wrapper for grid content */}
                        <TouchableOpacity style={[styles.promoCardWrapper, { backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={() => navigation.navigate('Discounts')}>
                            <View style={styles.promoCardContent}>
                                <View style={[styles.iconRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <View style={[styles.giftIconBox, { backgroundColor: colors.primary }]}>
                                        <Gift size={28} color="#fff" strokeWidth={2.5} />
                                        <View style={[styles.notificationBadge, { right: isRTL ? undefined : -4, left: isRTL ? -4 : undefined }]}>
                                            <Text style={styles.badgeText}>1</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.promoTexts}>
                                    <Text variant="body" weight="bold" style={{ textAlign, color: colors.textPrimary }} numberOfLines={2}>{t('exclusiveDiscounts')}</Text>
                                    <Text variant="caption" style={{ textAlign, color: colors.primary }} numberOfLines={2}>{t('dailyDiscounts')}</Text>
                                </View>
                                <View style={[styles.clickButton, { alignSelf: isRTL ? 'flex-end' : 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.primary }]}>
                                    <Text style={styles.clickText}>{t('clickHere')}</Text>
                                    <Text style={{ fontSize: 12 }}>👆</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.rightColumn}>
                            <TouchableOpacity style={[styles.featureCard, { flexDirection, backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={() => navigation.navigate('Safety', {})}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="body" weight="bold" style={{ textAlign, color: colors.textPrimary }} numberOfLines={1}>{t('enjoy')}</Text>
                                    <Text variant="caption" style={{ textAlign, color: colors.primary }} numberOfLines={2}>{t('safestTrips')}</Text>
                                </View>
                                <ShieldCheck size={24} color={colors.primary} fill={colors.surfaceHighlight} style={[styles.featureIcon, isRTL ? { marginRight: 8, marginLeft: 0 } : { marginLeft: 8, marginRight: 0 }]} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.featureCard, activeTravelRequestId ? { backgroundColor: isDark ? '#064E3B' : '#F0FDF4', borderColor: '#BBF7D0' } : { backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }, { flexDirection }]}
                                onPress={() => activeTravelRequestId ? (navigation.navigate as any)('SearchingDriver', { tripId: activeTravelRequestId }) : (navigation.navigate as any)('TravelRequest', {})}
                            >
                                <View style={{ flex: 1 }}>
                                    {activeTravelRequestId ? (
                                        <>
                                            <Text variant="body" weight="bold" style={{ textAlign, color: '#15803D' }}>{t('travelRequestActive') || 'Travel Active'}</Text>
                                            <Text variant="caption" style={{ textAlign, color: '#166534' }}>{t('tapToView') || 'Tap to view'}</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text variant="body" weight="bold" style={{ textAlign, color: colors.textPrimary }}>{t('enjoy')}</Text>
                                            <Text variant="body" weight="bold" style={{ textAlign, color: colors.textPrimary }}>{t('affordable')}</Text>
                                            <Text variant="body" weight="bold" style={{ textAlign, color: colors.textPrimary }}>{t('tripsWithUs')}</Text>
                                        </>
                                    )}
                                </View>
                                <CarFront size={24} color={activeTravelRequestId ? '#15803D' : colors.primary} fill={activeTravelRequestId ? '#DCFCE7' : colors.surfaceHighlight} style={[styles.featureIcon, isRTL ? { marginRight: 8, marginLeft: 0 } : { marginLeft: 8, marginRight: 0 }]} />
                            </TouchableOpacity>
                        </View>
                    </View>

                </Animated.View>
            </SafeAreaView>

            <PopupNotification role="customer" />
            <SideMenu visible={isSideMenuVisible} onClose={() => setSideMenuVisible(false)} />
            {/* ChatBotButton moved to floatingUI */}
            <ChatBotModal visible={isChatBotVisible} onClose={() => setChatBotVisible(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#EFF6FF' },
    mapLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E5E7EB', overflow: 'hidden' },
    mapBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F3F4F6' },
    overlayContainer: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingTop: 40
    },
    circleButton: {
        width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22,
        alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 5
    },
    locationHeader: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    locationHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1e1e1e' },
    locationHeaderSubtitle: { fontSize: 10, color: '#6B7280' },

    // Floating UI attached to sheet position
    // Base bottom = Sheet Max Height ~560. 
    floatingUI: { position: 'absolute', bottom: 565, width: '100%', height: 50, zIndex: 10 },
    safetyPill: {
        position: 'absolute', flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', paddingRight: 12, paddingLeft: 4, paddingVertical: 4, borderRadius: 20, gap: 8,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    },
    shieldIconBg: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
    safetyText: { fontSize: 12, fontWeight: '700', color: '#1e1e1e' },
    recenterButton: {
        position: 'absolute', width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22,
        alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 5
    },

    bottomSheet: {
        position: 'absolute', bottom: 0, width: '100%',
        backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 50,
        shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 20,
        zIndex: 20
    },
    dragHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

    searchCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 20,
        flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, borderWidth: 1, borderColor: '#F3F4F6'
    },
    searchIconBubble: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
    searchPlaceholder: { fontSize: 22, fontWeight: 'bold', color: '#111827' },

    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, marginBottom: 24 },
    pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CA3AF' },
    addressText: { color: '#6B7280', fontSize: 13, fontWeight: '500' },

    gridContainer: { flexDirection: 'row', gap: 12, height: 200 },

    promoCardWrapper: {
        flex: 1.3, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 4, borderWidth: 1, borderColor: '#F3F4F6', padding: 16
    },
    promoCardContent: { flex: 1, justifyContent: 'space-between' },
    iconRow: { flexDirection: 'row', alignItems: 'flex-start' },
    giftIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
    notificationBadge: { position: 'absolute', top: -4, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    promoTexts: { marginTop: 4 },
    promoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e1e1e', marginBottom: 4, lineHeight: 20 },
    promoSubtitle: { fontSize: 12, color: '#4F46E5', fontWeight: '500', lineHeight: 16 },
    clickButton: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
    clickText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    rightColumn: { flex: 1, gap: 12 },
    featureCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, flexDirection: 'row', borderWidth: 1, borderColor: '#FBFBFB', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2, overflow: 'hidden' },
    featureIcon: { alignSelf: 'flex-end', marginBottom: 0, marginLeft: 8 },
    featureTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e1e1e' },
    featureSubHighlight: { fontSize: 13, color: '#4F46E5', fontWeight: '500', marginTop: 4 },

    bannerContainer: { marginTop: 24, height: BANNER_HEIGHT, paddingBottom: 10 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    bannerScroll: { gap: 12, paddingRight: 20 },
    bannerItem: { width: 280, height: 120, borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } },
    bannerGradient: { flex: 1 },

    // Dynamic banner styles
    bannerLoading: { width: 280, height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16 },
    bannerLoadingText: { color: '#6B7280', fontSize: 14 },
    bannerImageContainer: { flex: 1, backgroundColor: '#fff' },
    bannerImage: { width: '100%', height: '100%' },
});
