import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Region, Marker } from 'react-native-maps';
import MapTileLayer from '../MapTileLayer';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';
import { X, MapPin, Locate, Navigation } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import * as Location from 'expo-location';
import { reverseGeocode } from '../../services/mapService';

interface MapPickerModalProps {
    onClose: () => void;
    onLocationSelected: (address: string, lat: number, lng: number) => void;
    title: string;
}

const { width, height } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const DEFAULT_REGION: Region = {
    latitude: 30.0444,
    longitude: 31.2357,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
};

export default function MapPickerModal({ onClose, onLocationSelected, title }: MapPickerModalProps) {
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();
    const mapRef = useRef<MapView>(null);
    const [region, setRegion] = useState<Region>(DEFAULT_REGION);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [addressPreview, setAddressPreview] = useState('');
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setAddressPreview('');

        (async () => {
            try {
                setLocating(true);
                const { status } = await Location.requestForegroundPermissionsAsync();

                if (status !== 'granted') {
                    if (isMounted) {
                        setLocating(false);
                        setAddressPreview(isRTL ? 'اسحب الخريطة لاختيار موقع' : 'Drag map to select location');
                    }
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced
                });

                if (!isMounted) return;

                const nextRegion: Region = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.008,
                    longitudeDelta: 0.008,
                };

                setRegion(nextRegion);

                // Wait for map to be ready before animating
                if (isMapReady) {
                    mapRef.current?.animateToRegion(nextRegion, 800);
                }

                fetchAddressPreview(nextRegion.latitude, nextRegion.longitude);
            } catch (err) {
                console.log('MapPicker location error:', err);
                if (isMounted) {
                    setAddressPreview(isRTL ? 'اسحب الخريطة لاختيار موقع' : 'Drag map to select location');
                }
            } finally {
                if (isMounted) setLocating(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [isMapReady]);

    const handleRegionChangeComplete = (nextRegion: Region) => {
        setRegion(nextRegion);
        fetchAddressPreview(nextRegion.latitude, nextRegion.longitude);
    };

    const handleCenterLocation = async () => {
        if (locating) return;
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocating(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High
            });
            const { latitude, longitude } = location.coords;

            const nextRegion: Region = {
                latitude,
                longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
            };

            mapRef.current?.animateToRegion(nextRegion, 600);
            setRegion(nextRegion);
            fetchAddressPreview(latitude, longitude);
        } catch (error) {
            console.log('Center location error:', error);
        } finally {
            setLocating(false);
        }
    };

    const fetchAddressPreview = async (lat: number, lng: number) => {
        try {
            const result = await reverseGeocode(lat, lng, isRTL ? 'ar' : 'en');
            setAddressPreview(result || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } catch (error) {
            console.log('Geocoding error:', error);
            setAddressPreview(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
    };

    const handleConfirm = async () => {
        if (loading) return;
        setLoading(true);

        try {
            // Do not block user confirmation on network geocoding latency.
            const address = addressPreview || `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`;
            onLocationSelected(address, region.latitude, region.longitude);
            onClose();
        } catch (error) {
            console.log('Confirm location error:', error);
            const address = addressPreview || `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`;
            onLocationSelected(address, region.latitude, region.longitude);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
                {/* Header */}
                <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.surface2 }]} activeOpacity={0.7}>
                        <X size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Navigation size={18} color={colors.primary} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Map */}
                <MapView
                    key={`chatbot-map-picker-${isDark ? 'dark' : 'light'}`}
                    ref={mapRef}
                    style={[styles.map, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                    initialRegion={region}
                    onRegionChangeComplete={handleRegionChangeComplete}
                    onMapReady={() => setIsMapReady(true)}
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                    customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                    userInterfaceStyle={isDark ? 'dark' : 'light'}
                >
                    <MapTileLayer isDark={isDark} />
                </MapView>

                {/* Center Pin */}
                <View pointerEvents="none" style={styles.centerMarkerContainer}>
                    <View style={styles.pinWrapper}>
                        <MapPin size={44} color={colors.primary} fill={colors.primary} strokeWidth={2.5} />
                        <View style={[styles.pinPulse, { backgroundColor: colors.primary }]} />
                    </View>
                    <View style={styles.markerShadow} />
                </View>

                {/* Bottom Controls */}
                <View style={[styles.bottomSheet, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                    <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

                    <View style={[styles.addressCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                        <View style={[styles.addressHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <MapPin size={16} color={colors.textMuted} />
                            <Text style={[styles.addressLabel, { color: colors.textMuted }]}>
                                {isRTL ? 'الموقع المحدد' : 'Selected Location'}
                            </Text>
                        </View>
                        <Text style={[styles.addressValue, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]} numberOfLines={3}>
                            {addressPreview || (isRTL ? 'جاري التحميل...' : 'Loading...')}
                        </Text>
                    </View>

                    <View style={[styles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <TouchableOpacity
                            style={[styles.locationButton, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}
                            onPress={handleCenterLocation}
                            activeOpacity={0.7}
                            disabled={locating}
                        >
                            {locating ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Locate size={22} color={colors.primary} strokeWidth={2.5} />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: colors.primary, shadowColor: colors.primary }, loading && styles.disabledButton]}
                            onPress={handleConfirm}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.textOnPrimary} />
                            ) : (
                                <Text style={[styles.confirmButtonText, { color: colors.textOnPrimary }]}>
                                    {isRTL ? 'تأكيد الموقع' : 'Confirm Location'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        zIndex: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
    },
    map: {
        flex: 1,
    },
    centerMarkerContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -22,
        marginTop: -56,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    pinWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinPulse: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        opacity: 0.2,
        top: 8,
    },
    markerShadow: {
        width: 12,
        height: 5,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.25)',
        marginTop: -4,
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
        alignSelf: 'center',
        marginBottom: 16,
    },
    addressCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    addressHeader: {
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    addressLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    addressValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
        lineHeight: 22,
    },
    actionsRow: {
        alignItems: 'center',
        gap: 12,
    },
    locationButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        minHeight: 56,
    },
    disabledButton: {
        opacity: 0.5,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
