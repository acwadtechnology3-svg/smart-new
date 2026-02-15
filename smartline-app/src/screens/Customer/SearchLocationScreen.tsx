import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    TextInput,
    Keyboard,
    I18nManager,
    Modal,
    Pressable,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Clock, MapPin, Plus, Flame, Home, Briefcase, Star, X, Check } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { searchPlaces, reverseGeocode } from '../../services/mapService';
import {
    getSavedLocations,
    addSavedLocation as saveLocationApi,
    deleteSavedLocation,
    SavedLocation,
    getSearchHistory,
    addSearchHistory,
    clearSearchHistory,
    SearchHistoryItem,
} from '../../services/savedLocationsService';
import * as Location from 'expo-location';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

type SearchLocationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SearchLocation'>;
type SearchLocationScreenRouteProp = RouteProp<RootStackParamList, 'SearchLocation'>;
type SearchField = 'pickup' | 'destination';

interface PlaceListItem {
    id?: string;
    name?: string;
    text?: string;
    address?: string;
    place_name?: string;
    center?: [number, number];
    icon?: 'clock' | 'flame' | 'star';
}

const MOCK_PLACES: PlaceListItem[] = [
    { id: '1', name: '2Q44+9QV', address: '2Q44+9QV, Ikingi Mariout (East & West), Amriya', icon: 'clock' },
    { id: '2', name: '3 Malwa', address: '3 Malwa Al Ibrahimiyah Bahri WA Sidi Gaber', icon: 'flame' },
    { id: '3', name: 'Water Station Mosque', address: 'Ezbet El-Nozha Sidi Gaber Alexandria', icon: 'flame' },
    { id: '4', name: 'Banque Du Cairo', address: 'Sidi Gaber Sidi Gaber Alexandria Governorate', icon: 'flame' },
    { id: '5', name: 'Mostafa Kamel', address: 'Mostafa Kamel Ezbet Saad Sidi Gaber', icon: 'flame' },
];

const MAX_FAVORITES = 3;

export default function SearchLocationScreen() {
    const navigation = useNavigation<SearchLocationScreenNavigationProp>();
    const route = useRoute<SearchLocationScreenRouteProp>();
    const { t, isRTL, language } = useLanguage();
    const { colors, isDark } = useTheme();

    // RTL Logic
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';
    const lineStyle = isSimulating ? { right: 11 } : { left: 11 };
    const iconMargin = isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16, marginLeft: 0 };

    const [pickup, setPickup] = useState(t('currentLocation'));
    const [destination, setDestination] = useState('');
    const [activeField, setActiveField] = useState<SearchField>('destination');
    const [results, setResults] = useState<PlaceListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchCache, setSearchCache] = useState<Record<string, PlaceListItem[]>>({});
    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
    const [history, setHistory] = useState<SearchHistoryItem[]>([]);
    const [favoriteModalVisible, setFavoriteModalVisible] = useState(false);
    const [isQuickSaving, setIsQuickSaving] = useState(false);
    const [deletingFavoriteId, setDeletingFavoriteId] = useState<string | null>(null);
    const [isClearingHistory, setIsClearingHistory] = useState(false);

    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [currentAddress, setCurrentAddress] = useState<string | null>(null);
    const [pickupCoordinates, setPickupCoordinates] = useState<[number, number] | null>(null);

    const pickupRef = useRef<TextInput | null>(null);
    const destinationRef = useRef<TextInput | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pickupValueRef = useRef(pickup);
    const currentAddressRef = useRef<string | null>(currentAddress);
    const pickupCoordinatesRef = useRef<[number, number] | null>(pickupCoordinates);

    const loadData = async () => {
        try {
            const [locs, hist] = await Promise.all([
                getSavedLocations(),
                getSearchHistory(),
            ]);
            setSavedLocations(locs || []);
            setHistory(hist || []);
        } catch (error) {
            console.log('Error loading saved locations/history', error);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        pickupValueRef.current = pickup;
    }, [pickup]);

    useEffect(() => {
        currentAddressRef.current = currentAddress;
    }, [currentAddress]);

    useEffect(() => {
        pickupCoordinatesRef.current = pickupCoordinates;
    }, [pickupCoordinates]);

    const isCurrentPickupSelection = (value: string) => {
        return value === t('currentLocation')
            || value === 'Current Location'
            || (!!currentAddressRef.current && value === currentAddressRef.current);
    };

    // Handle return from LocationPicker
    useEffect(() => {
        const params = route.params;
        if (!params?.selectedAddress) return;

        const { selectedAddress, selectedCoordinates, field, saveAs } = params;

        if (saveAs && selectedCoordinates) {
            const existingForType = saveAs !== 'favorite'
                ? savedLocations.find((item) => item.type === saveAs)
                : undefined;

            if (existingForType?.id) {
                deleteSavedLocation(existingForType.id)
                    .catch(() => null)
                    .finally(() => {
                        saveLocationApi({
                            type: saveAs,
                            name: saveAs === 'home' ? t('home') : saveAs === 'work' ? t('work') : selectedAddress,
                            address: selectedAddress,
                            lat: selectedCoordinates.latitude,
                            lng: selectedCoordinates.longitude,
                        }).then(() => loadData());
                    });
            } else {
                saveLocationApi({
                    type: saveAs,
                    name: saveAs === 'home' ? t('home') : saveAs === 'work' ? t('work') : selectedAddress,
                    address: selectedAddress,
                    lat: selectedCoordinates.latitude,
                    lng: selectedCoordinates.longitude,
                }).then(() => loadData());
            }
        }

        if (params.returnScreen) {
            const targetField = field || 'destination';
            const placeData = {
                address: selectedAddress,
                lat: selectedCoordinates?.latitude,
                lng: selectedCoordinates?.longitude,
            };

            navigation.navigate(params.returnScreen as any, {
                pickup: params.currentPickup,
                destination: params.currentDest,
                [targetField]: placeData,
            });
            return;
        }

        if (field === 'pickup') {
            pickupValueRef.current = selectedAddress;
            pickupCoordinatesRef.current = selectedCoordinates
                ? [selectedCoordinates.longitude, selectedCoordinates.latitude]
                : null;
            setPickup(selectedAddress);
            setPickupCoordinates(
                selectedCoordinates
                    ? [selectedCoordinates.longitude, selectedCoordinates.latitude]
                    : null
            );
            setActiveField('destination');
            setTimeout(() => destinationRef.current?.focus(), 300);
            return;
        }

        setDestination(selectedAddress);
        const destCoords: [number, number] | undefined = selectedCoordinates
            ? [selectedCoordinates.longitude, selectedCoordinates.latitude]
            : undefined;

        navigation.navigate('TripOptions', {
            pickup: pickupValueRef.current,
            destination: selectedAddress,
            destinationCoordinates: destCoords,
            pickupCoordinates: pickupCoordinatesRef.current ?? undefined,
        });
    }, [route.params?.selectionId, route.params?.selectedAddress, navigation]);

    // Get proximity location on mount
    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted' || !isMounted) return;

                const loc = await Location.getCurrentPositionAsync({});
                if (!isMounted) return;

                const userCoords: [number, number] = [loc.coords.longitude, loc.coords.latitude];
                setUserLocation(userCoords);

                if (isCurrentPickupSelection(pickupValueRef.current)) {
                    pickupCoordinatesRef.current = userCoords;
                    setPickupCoordinates(userCoords);
                    const address = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
                    if (!isMounted) return;

                    if (address && isCurrentPickupSelection(pickupValueRef.current)) {
                        setCurrentAddress(address);
                        currentAddressRef.current = address;
                        setPickup(address);
                        pickupValueRef.current = address;
                    }
                }
            } catch (error) {
                console.log('Error getting location for search proximity', error);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [t]);

    const handleSearch = (text: string) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (text.length < 3) {
            setResults([]);
            return;
        }

        if (searchCache[text]) {
            setResults(searchCache[text]);
            return;
        }

        setIsLoading(true);
        timeoutRef.current = setTimeout(async () => {
            try {
                const isIntercity = route.params?.returnScreen === 'TravelRequest';
                const searchTypes = isIntercity ? 'place,locality' : undefined;

                const places = await searchPlaces(text, userLocation || undefined, searchTypes, language);
                setSearchCache((prev) => ({ ...prev, [text]: places }));
                setResults(places);
            } finally {
                setIsLoading(false);
            }
        }, 700);
    };

    const handleClearHistory = async () => {
        try {
            setIsClearingHistory(true);
            await clearSearchHistory();
            setHistory([]);
        } catch (error) {
            console.log('Failed clearing history', error);
            Alert.alert(t('error'), t('genericError'));
        } finally {
            setIsClearingHistory(false);
        }
    };

    const handlePickupChange = (text: string) => {
        pickupValueRef.current = text;
        pickupCoordinatesRef.current = null;
        setPickup(text);
        setPickupCoordinates(null);
        setActiveField('pickup');
        handleSearch(text);
    };

    const handleDestinationChange = (text: string) => {
        setDestination(text);
        setActiveField('destination');
        handleSearch(text);
    };

    useEffect(() => {
        if (route.params?.field) {
            setActiveField(route.params.field);
            if (route.params.field === 'pickup') {
                if (pickup === t('currentLocation')) setPickup('');
                setTimeout(() => pickupRef.current?.focus(), 100);
            } else {
                setTimeout(() => destinationRef.current?.focus(), 100);
            }
            return;
        }

        const id = setTimeout(() => {
            destinationRef.current?.focus();
            setActiveField('destination');
        }, 100);

        return () => clearTimeout(id);
    }, [route.params?.field, pickup, t]);

    const handleSelectPlace = (place: PlaceListItem) => {
        Keyboard.dismiss();

        const selectedAddress = place.place_name || place.address || place.name;
        if (!selectedAddress) return;

        const placeData = place.center
            ? {
                address: selectedAddress,
                lat: place.center[1],
                lng: place.center[0],
            }
            : { address: selectedAddress };

        if (place.center) {
            addSearchHistory(selectedAddress, place.center[1], place.center[0])
                .then(() => loadData())
                .catch(() => null);
        }

        if (route.params?.returnScreen) {
            navigation.navigate(route.params.returnScreen as any, {
                [activeField]: placeData,
            });
            return;
        }

        if (activeField === 'pickup') {
            pickupValueRef.current = selectedAddress;
            pickupCoordinatesRef.current = place.center ? [place.center[0], place.center[1]] : null;
            setPickup(selectedAddress);
            setPickupCoordinates(place.center ? [place.center[0], place.center[1]] : null);
            setActiveField('destination');
            setTimeout(() => destinationRef.current?.focus(), 100);
            return;
        }

        setDestination(selectedAddress);
        navigation.navigate('TripOptions', {
            pickup: pickupValueRef.current,
            destination: selectedAddress,
            destinationCoordinates: place.center,
            pickupCoordinates: pickupCoordinatesRef.current ?? undefined,
        });
    };

    const navigateToLocationPicker = (field: SearchField) => {
        navigation.navigate('LocationPicker', {
            field,
            returnScreen: route.params?.returnScreen,
            currentPickup: route.params?.currentPickup ?? pickup,
            currentDest: route.params?.currentDest ?? destination,
        });
    };

    const homeLocation = savedLocations.find((item) => item.type === 'home');
    const workLocation = savedLocations.find((item) => item.type === 'work');
    const favoriteLocations = savedLocations.filter((item) => item.type === 'favorite');

    const quickSaveCandidate = useMemo(() => {
        const pickupText = pickup.trim();
        const pickupPlaceholder = t('currentLocation');

        if (pickupCoordinates && pickupText.length > 0 && pickupText !== pickupPlaceholder) {
            return {
                address: pickupText,
                lat: pickupCoordinates[1],
                lng: pickupCoordinates[0],
            };
        }

        if (pickupText.length > 0 && pickupText !== pickupPlaceholder) {
            return null;
        }

        if (currentAddress && userLocation) {
            return {
                address: currentAddress,
                lat: userLocation[1],
                lng: userLocation[0],
            };
        }

        return null;
    }, [currentAddress, pickup, pickupCoordinates, t, userLocation]);

    const saveQuickLocation = async (type: 'home' | 'work' | 'favorite') => {
        if (!quickSaveCandidate) {
            Alert.alert(t('error'), t('fetchingLocation'));
            return;
        }

        if (type === 'favorite') {
            if (favoriteLocations.length >= MAX_FAVORITES) {
                Alert.alert(t('favorites'), `You can save up to ${MAX_FAVORITES} favorites.`);
                return;
            }

            const isDuplicate = favoriteLocations.some((favorite) =>
                Math.abs(favorite.lat - quickSaveCandidate.lat) < 0.00001 &&
                Math.abs(favorite.lng - quickSaveCandidate.lng) < 0.00001
            );

            if (isDuplicate) {
                Alert.alert(t('favorites'), 'This location is already saved.');
                return;
            }
        }

        try {
            setIsQuickSaving(true);

            if (type !== 'favorite') {
                const existing = savedLocations.find((item) => item.type === type);
                if (existing?.id) {
                    await deleteSavedLocation(existing.id);
                }
            }

            await saveLocationApi({
                type,
                name: type === 'home'
                    ? t('home')
                    : type === 'work'
                        ? t('work')
                        : quickSaveCandidate.address.split(',')[0].trim(),
                address: quickSaveCandidate.address,
                lat: quickSaveCandidate.lat,
                lng: quickSaveCandidate.lng,
            });

            await loadData();
        } catch (error) {
            console.log('Error saving quick location', error);
            Alert.alert(t('error'), t('genericError'));
        } finally {
            setIsQuickSaving(false);
        }
    };

    const deleteFavorite = async (favorite: SavedLocation) => {
        if (!favorite.id) return;

        try {
            setDeletingFavoriteId(favorite.id);
            await deleteSavedLocation(favorite.id);
            await loadData();
        } catch (error) {
            console.log('Failed deleting favorite', error);
            Alert.alert(t('error'), t('genericError'));
        } finally {
            setDeletingFavoriteId(null);
        }
    };

    const confirmDeleteFavorite = (favorite: SavedLocation) => {
        Alert.alert(
            t('delete'),
            'Delete this favorite location?',
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: () => deleteFavorite(favorite),
                },
            ],
        );
    };

    const useSavedLocation = (location: SavedLocation) => {
        handleSelectPlace({
            id: location.id,
            name: location.name,
            place_name: location.address,
            center: [location.lng, location.lat],
            address: location.address,
        });
    };

    const handleQuickAccess = (type: 'home' | 'work' | 'favorite') => {
        if (type === 'favorite') {
            setFavoriteModalVisible(true);
            return;
        }

        const saved = savedLocations.find((item) => item.type === type);
        if (saved) {
            useSavedLocation(saved);
            return;
        }

        saveQuickLocation(type);
    };

    const renderListIcon = (item: PlaceListItem) => {
        if (item.icon === 'clock') {
            return <Clock size={20} color={colors.textMuted} />;
        }
        if (item.icon === 'flame') {
            return <Flame size={20} color={colors.danger} />;
        }
        if (item.icon === 'star') {
            return <Star size={20} color={colors.warning} fill={colors.warning} />;
        }
        return <MapPin size={20} color={colors.textPrimary} />;
    };

    const favoriteListData: PlaceListItem[] = savedLocations
        .filter((item) => item.type === 'favorite')
        .map((item) => ({
            id: item.id || `${item.lat}-${item.lng}`,
            name: item.name,
            place_name: item.address,
            center: [item.lng, item.lat] as [number, number],
            icon: 'star' as const,
        }));

    const historyData: PlaceListItem[] = history.map((item) => ({
        id: item.id,
        name: item.address.split(',')[0],
        place_name: item.address,
        center: [item.lng, item.lat] as [number, number],
        icon: 'clock' as const,
    }));

    const defaultData: PlaceListItem[] = [
        ...historyData,
        ...favoriteListData,
    ];

    const activeSearchText = activeField === 'pickup' ? pickup : destination;
    const isShowingSearchResults = activeSearchText.trim().length >= 3;
    const displayData = isShowingSearchResults
        ? results
        : defaultData.length > 0
            ? defaultData
            : MOCK_PLACES;

    const isHomeSaved = Boolean(homeLocation);
    const isWorkSaved = Boolean(workLocation);
    const hasFavorites = favoriteLocations.length > 0;
    const canAddFavorite = favoriteLocations.length < MAX_FAVORITES && Boolean(quickSaveCandidate);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.contentContainer}>
                <View style={styles.topSection}>
                    <View style={[styles.headerRow, { flexDirection }]}>
                        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface2 }]} onPress={() => navigation.goBack()}>
                            <ArrowLeft size={22} color={colors.textPrimary} />
                        </TouchableOpacity>

                        <View style={styles.inputCluster}>
                            <View style={[styles.connectingLine, lineStyle, { backgroundColor: colors.border }]} />

                            <View style={[styles.inputRow, { flexDirection }]}>
                                <View style={[styles.dot, styles.dotPickup]} />
                                <View style={[
                                    styles.inputContainer,
                                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                                    activeField === 'pickup' && styles.activeInput,
                                    activeField === 'pickup' && { borderColor: colors.primary },
                                ]}>
                                    <TextInput
                                        ref={pickupRef}
                                        style={[styles.textInput, { textAlign, color: colors.textPrimary }]}
                                        value={pickup}
                                        placeholder={t('enterPickupLocation')}
                                        placeholderTextColor={colors.textMuted}
                                        onFocus={() => setActiveField('pickup')}
                                        onChangeText={handlePickupChange}
                                    />
                                    {pickup.length > 0 && (
                                        <TouchableOpacity style={styles.clearButton} onPress={() => handlePickupChange('')}>
                                            <Text style={[styles.clearButtonText, { color: colors.textMuted }]}>x</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <View style={[styles.inputRow, { flexDirection }]}>
                                <View style={[styles.dot, styles.dotDest]} />
                                <View style={[
                                    styles.inputContainer,
                                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                                    activeField === 'destination' && styles.activeInput,
                                    activeField === 'destination' && { borderColor: colors.primary },
                                ]}>
                                    <TextInput
                                        ref={destinationRef}
                                        style={[styles.textInput, { textAlign, color: colors.textPrimary }]}
                                        value={destination}
                                        placeholder={t('searchDestination')}
                                        placeholderTextColor={colors.textMuted}
                                        onFocus={() => setActiveField('destination')}
                                        onChangeText={handleDestinationChange}
                                    />
                                    {destination.length > 0 && (
                                        <TouchableOpacity style={styles.clearButton} onPress={() => handleDestinationChange('')}>
                                            <Text style={[styles.clearButtonText, { color: colors.textMuted }]}>x</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.mapButton, { backgroundColor: colors.surfaceHighlight }]} onPress={() => navigateToLocationPicker(activeField)}>
                        <View style={styles.mapIconCircle}>
                            <MapPin size={16} color={colors.primary} />
                        </View>
                        <Text style={[styles.mapButtonText, { color: colors.primary }]}>{t('chooseOnMap')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.quickAccessRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAccess('home')} disabled={isQuickSaving}>
                        <View style={[
                            styles.iconBadgeContainer,
                            { backgroundColor: colors.surface2 },
                            isHomeSaved && styles.activeIconCircle,
                            isHomeSaved && { backgroundColor: colors.primary },
                        ]}>
                            <Home
                                size={20}
                                color={isHomeSaved ? colors.textOnPrimary : colors.textSecondary}
                                fill={isHomeSaved ? colors.textOnPrimary : 'none'}
                            />
                            {isHomeSaved && (
                                <View style={[styles.savedBadge, { backgroundColor: colors.success, borderColor: colors.surface }]}>
                                    <Check size={10} color={colors.textOnPrimary} strokeWidth={3} />
                                </View>
                            )}
                        </View>
                        <Text style={[styles.quickBtnText, { color: colors.textSecondary }, isHomeSaved && styles.activeBtnText, isHomeSaved && { color: colors.primary }]}>{t('home')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAccess('work')} disabled={isQuickSaving}>
                        <View style={[
                            styles.iconBadgeContainer,
                            { backgroundColor: colors.surface2 },
                            isWorkSaved && styles.activeIconCircle,
                            isWorkSaved && { backgroundColor: colors.primary },
                        ]}>
                            <Briefcase
                                size={20}
                                color={isWorkSaved ? colors.textOnPrimary : colors.textSecondary}
                                fill={isWorkSaved ? colors.textOnPrimary : 'none'}
                            />
                            {isWorkSaved && (
                                <View style={[styles.savedBadge, { backgroundColor: colors.success, borderColor: colors.surface }]}>
                                    <Check size={10} color={colors.textOnPrimary} strokeWidth={3} />
                                </View>
                            )}
                        </View>
                        <Text style={[styles.quickBtnText, { color: colors.textSecondary }, isWorkSaved && styles.activeBtnText, isWorkSaved && { color: colors.primary }]}>{t('work')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAccess('favorite')}>
                        <View style={[
                            styles.iconBadgeContainer,
                            { backgroundColor: colors.surface2 },
                            hasFavorites && styles.activeIconCircle,
                            hasFavorites && { backgroundColor: colors.primary },
                        ]}>
                            <Star
                                size={20}
                                color={hasFavorites ? colors.textOnPrimary : colors.textSecondary}
                                fill={hasFavorites ? colors.textOnPrimary : 'none'}
                            />
                            {hasFavorites && (
                                <View style={[styles.savedBadge, { backgroundColor: colors.success, borderColor: colors.surface }]}>
                                    <Check size={10} color={colors.textOnPrimary} strokeWidth={3} />
                                </View>
                            )}
                        </View>
                        <Text style={[styles.quickBtnText, { color: colors.textSecondary }, hasFavorites && styles.activeBtnText, hasFavorites && { color: colors.primary }]}>{t('favorites')}</Text>
                        <Text style={[styles.quickMetaText, { color: colors.textMuted }]}>{favoriteLocations.length}/{MAX_FAVORITES}</Text>
                    </TouchableOpacity>
                </View>

                {isLoading && (
                    <View style={styles.loadingIndicator}>
                        <Text style={[styles.loadingText, { color: colors.primary }]}>{t('searchingInEgypt')}</Text>
                    </View>
                )}

                {!isShowingSearchResults && (
                    <View style={[styles.historyHeaderRow, { borderBottomColor: colors.border, flexDirection }]}>
                        <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>{t('recentLocations')}</Text>
                        {historyData.length > 0 ? (
                            <TouchableOpacity onPress={handleClearHistory} disabled={isClearingHistory}>
                                {isClearingHistory ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Text style={[styles.clearHistoryText, { color: colors.primary }]}>{t('clearAll')}</Text>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <Text style={[styles.emptyHistoryText, { color: colors.textMuted }]}>{t('noRecentLocations')}</Text>
                        )}
                    </View>
                )}

                <FlatList
                    keyboardShouldPersistTaps="handled"
                    data={displayData}
                    keyExtractor={(item, index) => item.id || `${item.place_name || item.name || 'place'}-${index}`}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.resultItem, { flexDirection }]}
                            onPress={() => handleSelectPlace(item)}
                        >
                            <View style={[styles.iconContainer, iconMargin, { backgroundColor: colors.surface2 }]}>
                                {renderListIcon(item)}
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.placeName, { textAlign, color: colors.textPrimary }]}>{item.text || item.name}</Text>
                                <Text style={[styles.placeAddress, { textAlign, color: colors.textMuted }]} numberOfLines={2}>
                                    {item.place_name || item.address}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />

                <Modal
                    visible={favoriteModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setFavoriteModalVisible(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setFavoriteModalVisible(false)} />
                        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalHeader, { flexDirection }]}> 
                                <Text style={[styles.modalTitle, { textAlign, color: colors.textPrimary }]}> 
                                    {t('favorites')} ({favoriteLocations.length}/{MAX_FAVORITES})
                                </Text>
                                <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.surface2 }]} onPress={() => setFavoriteModalVisible(false)}>
                                    <X size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {favoriteLocations.length === 0 ? (
                                <Text style={[styles.emptyFavoritesText, { textAlign, color: colors.textSecondary }]}>No favorites saved yet.</Text>
                            ) : (
                                <View style={styles.favoriteList}>
                                    {favoriteLocations.map((favorite) => (
                                        <View key={favorite.id || `${favorite.lat}-${favorite.lng}`} style={[styles.favoriteRow, { flexDirection, borderColor: colors.border }]}> 
                                            <TouchableOpacity
                                                style={styles.favoriteMainBtn}
                                                onPress={() => {
                                                    setFavoriteModalVisible(false);
                                                    useSavedLocation(favorite);
                                                }}
                                            >
                                                <Text style={[styles.favoriteName, { textAlign, color: colors.textPrimary }]} numberOfLines={1}>
                                                    {favorite.name || t('favorites')}
                                                </Text>
                                                <Text style={[styles.favoriteAddress, { textAlign, color: colors.textSecondary }]} numberOfLines={2}>
                                                    {favorite.address}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.deleteFavoriteBtn, { backgroundColor: isDark ? 'rgba(248,113,113,0.16)' : '#FEF2F2' }]}
                                                onPress={() => confirmDeleteFavorite(favorite)}
                                                disabled={deletingFavoriteId === favorite.id}
                                            >
                                                {deletingFavoriteId === favorite.id ? (
                                                    <ActivityIndicator size="small" color={colors.danger} />
                                                ) : (
                                                    <X size={16} color={colors.danger} />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.addFavoriteBtn, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }, !canAddFavorite && styles.disabledAction]}
                                onPress={() => saveQuickLocation('favorite')}
                                disabled={!canAddFavorite || isQuickSaving}
                            >
                                {isQuickSaving ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Plus size={16} color={colors.primary} />
                                )}
                                <Text style={[styles.addFavoriteText, { color: colors.primary }]}>
                                    {favoriteLocations.length >= MAX_FAVORITES
                                        ? `Maximum ${MAX_FAVORITES} favorites reached`
                                        : 'Save current location'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    contentContainer: { flex: 1 },
    topSection: { alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
    headerRow: { alignItems: 'flex-start' },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginTop: 6,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    inputCluster: { flex: 1, position: 'relative' },
    connectingLine: {
        position: 'absolute',
        left: 11,
        top: 24,
        bottom: 24,
        width: 1,
        backgroundColor: '#E5E7EB',
        zIndex: -1,
    },
    inputRow: { alignItems: 'center', marginBottom: 10 },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginLeft: 6 },
    dotPickup: { backgroundColor: '#4F46E5' },
    dotDest: { backgroundColor: '#4F46E5' },
    inputContainer: {
        flex: 1,
        height: 48,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activeInput: { borderColor: '#4F46E5' },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#1e1e1e',
        fontWeight: '500',
        padding: 0,
        margin: 0,
        height: 46,
    },
    clearButton: { padding: 4, marginLeft: 4 },
    clearButtonText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
    actionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    mapIconCircle: { marginRight: 8 },
    mapButtonText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },

    quickAccessRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingVertical: 12,
        paddingHorizontal: 8,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#EEF2F7',
    },
    quickBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
    quickBtnText: { color: '#4B5563', fontSize: 12, fontWeight: '500', marginTop: 4 },
    activeBtnText: { color: '#4F46E5', fontWeight: 'bold' },
    quickMetaText: { marginTop: 2, color: '#94A3B8', fontSize: 10, fontWeight: '600' },
    iconBadgeContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    activeIconCircle: { backgroundColor: '#4F46E5' },
    savedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },

    listContent: { paddingBottom: 26 },
    resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24 },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: { flex: 1 },
    placeName: { fontSize: 16, fontWeight: '600', color: '#1e1e1e', marginBottom: 4 },
    placeAddress: { fontSize: 13, color: '#9CA3AF' },
    loadingIndicator: { paddingTop: 8, paddingLeft: 28 },
    loadingText: { fontSize: 12, color: '#4F46E5', fontStyle: 'italic' },
    historyHeaderRow: {
        marginHorizontal: 16,
        marginBottom: 4,
        paddingBottom: 10,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    historyTitle: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    clearHistoryText: {
        fontSize: 12,
        fontWeight: '700',
    },
    emptyHistoryText: {
        fontSize: 12,
        fontWeight: '500',
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        maxHeight: '70%',
    },
    modalHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    modalTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeModalBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    emptyFavoritesText: {
        fontSize: 14,
        color: '#6B7280',
        marginVertical: 12,
    },
    favoriteList: {
        gap: 10,
    },
    favoriteRow: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    favoriteMainBtn: {
        flex: 1,
    },
    favoriteName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    favoriteAddress: {
        marginTop: 2,
        fontSize: 12,
        color: '#6B7280',
    },
    deleteFavoriteBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        marginLeft: 8,
    },
    addFavoriteBtn: {
        marginTop: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        backgroundColor: '#EEF2FF',
        paddingVertical: 12,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    addFavoriteText: {
        color: '#4F46E5',
        fontWeight: '700',
        fontSize: 13,
    },
    disabledAction: {
        opacity: 0.55,
    },
});
