import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Dimensions, ActivityIndicator, Platform } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import MapTileLayer from '../../components/MapTileLayer';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { useTheme } from '../../theme/useTheme';
import { EMPTY_MAP_STYLE, DARK_EMPTY_MAP_STYLE } from '../../constants/MapStyles';

type LocationPickerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LocationPicker'>;
type LocationPickerRouteProp = RouteProp<RootStackParamList, 'LocationPicker'>;

const { width, height } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function LocationPickerScreen() {
    const navigation = useNavigation<LocationPickerNavigationProp>();
    const route = useRoute<LocationPickerRouteProp>();
    const { colors, isDark } = useTheme();
    const { field } = route.params;

    const [region, setRegion] = useState<Region | undefined>(undefined); // 👽 02-02-2026: Changed to undefined initially to wait for location
    // const [region, setRegion] = useState<Region>({ ... });
    const [address, setAddress] = useState<string>('Loading...');
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);

    // Get current location on mount
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let location = await Location.getCurrentPositionAsync({});
            setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
            // 👽 02-02-2026: Fetch initial address
            fetchAddress(location.coords.latitude, location.coords.longitude);
        })();
    }, []);

    // 👽 02-02-2026: Memoize handlers to keep props stable
    const onRegionChange = React.useCallback(() => {
        setIsDragging(true);
    }, []);

    const onRegionChangeComplete = React.useCallback(async (newRegion: Region) => {
        // regionRef.current = newRegion; // Keep track via ref
        // 👽 Update ref directly? Yes.
        // But we need to update the ref variable derived from state? No, regionRef is a ref.
        // We can't access regionRef inside useCallback unless it's in deps or we use a ref for the ref? 
        // Actually, just using a module-level var or maintaining the ref pattern is fine.
        // To be safe and clean, let's just do the fetching here.

        setIsDragging(false);
        fetchAddress(newRegion.latitude, newRegion.longitude);
    }, []);

    const regionRef = React.useRef<Region | undefined>(undefined); // 👽 02-02-2026: Restored regionRef

    const fetchAddress = async (lat: number, lng: number) => {
        setLoading(true);
        try {
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi,neighborhood`;
            const response = await axios.get(url);
            if (response.data.features && response.data.features.length > 0) {
                setAddress(response.data.features[0].place_name);
            } else {
                setAddress('Unknown location');
            }
        } catch (error) {
            console.error(error);
            setAddress('Error fetching address');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        const currentRegion = regionRef.current || region;
        if (!currentRegion) return;

        const payload = {
            selectedAddress: address,
            selectedCoordinates: { latitude: currentRegion.latitude, longitude: currentRegion.longitude },
            selectionId: Date.now(),
            field: field,
            returnScreen: route.params.returnScreen,
            currentPickup: route.params.currentPickup,
            currentDest: route.params.currentDest,
            saveAs: route.params.saveAs
        };

        if (route.params.returnScreen === 'LocationPreferences') {
            navigation.navigate('LocationPreferences', payload as any);
            return;
        }

        navigation.navigate('SearchLocation', payload);
    };

    return (
        <View style={styles.container}>
            {region && (
                <MapView
                    key={`location-picker-map-${isDark ? 'dark' : 'light'}`}
                    style={[styles.map, { backgroundColor: isDark ? '#212121' : '#f5f5f5' }]}
                    initialRegion={region}
                    onRegionChange={onRegionChange}
                    onRegionChangeComplete={(r) => {
                        regionRef.current = r; // Update ref
                        onRegionChangeComplete(r);
                    }}
                    mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                    customMapStyle={isDark ? DARK_EMPTY_MAP_STYLE : EMPTY_MAP_STYLE}
                    userInterfaceStyle={isDark ? 'dark' : 'light'}
                >
                    <MapTileLayer isDark={isDark} />
                </MapView>
            )}

            <View style={styles.centerMarkerContainer} pointerEvents="none">
                <MapPin size={40} color={colors.primary} fill={colors.primary} />
                <View style={[styles.markerDot, { backgroundColor: colors.textPrimary }]} />
            </View>

            {/* Header Overlay */}
            <SafeAreaView style={styles.header} pointerEvents="box-none">
                <TouchableOpacity
                    style={[
                        styles.backButton,
                        {
                            backgroundColor: colors.surface,
                            shadowColor: colors.shadow,
                        },
                    ]}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Bottom Sheet for confirmation */}
            <View
                style={[
                    styles.bottomSheet,
                    {
                        backgroundColor: colors.surface,
                        shadowColor: colors.shadow,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Text style={[styles.label, { color: colors.textMuted }]}>{field === 'pickup' ? 'Pick up location' : 'Destination'}</Text>

                <View style={[styles.addressContainer, { borderBottomColor: colors.border }]}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={2}>{address}</Text>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
                    onPress={handleConfirm}
                    disabled={loading}
                >
                    <Text style={[styles.confirmButtonText, { color: colors.textOnPrimary }]}>Confirm Location</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { flex: 1 },
    header: { position: 'absolute', top: 40, left: 0, right: 0, padding: 16 }, // 👽 02-02-2026: Increased top (was 0)
    backButton: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3
    },
    centerMarkerContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 40 // Adjust for pin height so the tip is at center
    },
    markerDot: {
        width: 4, height: 4, borderRadius: 2, backgroundColor: '#000', marginTop: -4, opacity: 0.3
    },
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24,
        borderTopWidth: 1,
        shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10
    },
    label: { fontSize: 14, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
    addressContainer: {
        minHeight: 50, justifyContent: 'center', marginBottom: 20,
        borderBottomWidth: 1, paddingBottom: 16
    },
    addressText: { fontSize: 18, fontWeight: '600' },
    confirmButton: {
        paddingVertical: 16, borderRadius: 12, alignItems: 'center'
    },
    disabledButton: { opacity: 0.7 },
    confirmButtonText: { fontSize: 16, fontWeight: 'bold' }
});
