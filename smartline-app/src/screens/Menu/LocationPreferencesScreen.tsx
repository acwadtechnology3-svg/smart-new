import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Home, Briefcase, Star, Pencil, Trash2, Plus } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { addSavedLocation, deleteSavedLocation, getSavedLocations, SavedLocation } from '../../services/savedLocationsService';
import { useTheme } from '../../theme/useTheme';
import { useLanguage } from '../../context/LanguageContext';

type LocationPreferencesNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LocationPreferences'>;
type LocationPreferencesRouteProp = RouteProp<RootStackParamList, 'LocationPreferences'>;

const MAX_FAVORITES = 3;

export default function LocationPreferencesScreen() {
    const navigation = useNavigation<LocationPreferencesNavigationProp>();
    const route = useRoute<LocationPreferencesRouteProp>();
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLanguage();

    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingType, setSavingType] = useState<'home' | 'work' | 'favorite' | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pendingEdit, setPendingEdit] = useState<SavedLocation | null>(null);

    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';

    const loadLocations = async () => {
        try {
            const data = await getSavedLocations();
            setSavedLocations(data || []);
        } catch (error) {
            console.log('Failed to load saved locations', error);
            Alert.alert(t('error'), t('genericError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocations();
    }, []);

    const homeLocation = useMemo(() => savedLocations.find((item) => item.type === 'home'), [savedLocations]);
    const workLocation = useMemo(() => savedLocations.find((item) => item.type === 'work'), [savedLocations]);
    const favoriteLocations = useMemo(() => savedLocations.filter((item) => item.type === 'favorite'), [savedLocations]);

    const openPicker = (type: 'home' | 'work' | 'favorite', location?: SavedLocation | null) => {
        setPendingEdit(location || null);
        navigation.navigate('LocationPicker', {
            field: 'destination',
            saveAs: type,
            returnScreen: 'LocationPreferences',
        });
    };

    const handleDelete = (location: SavedLocation) => {
        if (!location.id) return;

        Alert.alert(
            t('delete'),
            t('deleteLocationConfirm'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingId(location.id || null);
                            await deleteSavedLocation(location.id!);
                            await loadLocations();
                        } catch (error) {
                            console.log('Failed deleting location', error);
                            Alert.alert(t('error'), t('genericError'));
                        } finally {
                            setDeletingId(null);
                        }
                    },
                },
            ],
        );
    };

    useEffect(() => {
        const params = route.params;
        if (!params?.selectedAddress || !params.selectedCoordinates || !params.saveAs) return;

        const selectedAddress = params.selectedAddress;
        const selectedCoordinates = params.selectedCoordinates;
        const targetType = params.saveAs;

        const saveSelectedLocation = async () => {
            try {
                setSavingType(targetType);
                const existing = pendingEdit
                    || (targetType !== 'favorite' ? savedLocations.find((item) => item.type === targetType) : undefined);

                if (existing?.id) {
                    await deleteSavedLocation(existing.id);
                }

                await addSavedLocation({
                    type: targetType,
                    name: targetType === 'home'
                        ? t('home')
                        : targetType === 'work'
                            ? t('work')
                            : (pendingEdit?.name || selectedAddress.split(',')[0].trim()),
                    address: selectedAddress,
                    lat: selectedCoordinates.latitude,
                    lng: selectedCoordinates.longitude,
                });

                await loadLocations();
            } catch (error) {
                console.log('Failed saving selected location', error);
                Alert.alert(t('error'), t('saveFailed'));
            } finally {
                setPendingEdit(null);
                setSavingType(null);
            }
        };

        saveSelectedLocation();
    }, [route.params?.selectionId]);

    const renderPrimaryLocationCard = (
        type: 'home' | 'work',
        label: string,
        icon: React.ReactNode,
        location?: SavedLocation,
    ) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.rowBetween, { flexDirection }]}>
                <View style={[styles.rowStart, { flexDirection }]}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>{icon}</View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary, textAlign }]}>{label}</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary, textAlign }]} numberOfLines={2}>
                            {location?.address || (type === 'home' ? t('homeLocationNotSet') : t('workLocationNotSet'))}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={[styles.actionsRow, { flexDirection }]}>
                <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }]}
                    onPress={() => openPicker(type, location)}
                >
                    <Pencil size={14} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>{location ? t('updateLocation') : t('setLocation')}</Text>
                </TouchableOpacity>

                {!!location && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: colors.danger, backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#FEF2F2' }]}
                        onPress={() => handleDelete(location)}
                        disabled={deletingId === location.id}
                    >
                        {deletingId === location.id ? (
                            <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                            <>
                                <Trash2 size={14} color={colors.danger} />
                                <Text style={[styles.actionText, { color: colors.danger }]}>{t('delete')}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const isFavoritesFull = favoriteLocations.length >= MAX_FAVORITES;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { flexDirection, backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={22} color={colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('locationPreferences')}</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign }]}>{t('manageSavedLocations')}</Text>

                {renderPrimaryLocationCard(
                    'home',
                    t('home'),
                    <Home size={18} color={colors.primary} />,
                    homeLocation,
                )}

                {renderPrimaryLocationCard(
                    'work',
                    t('work'),
                    <Briefcase size={18} color={colors.primary} />,
                    workLocation,
                )}

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.rowBetween, { flexDirection }]}>
                        <View style={[styles.rowStart, { flexDirection }]}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>
                                <Star size={18} color={colors.warning} fill={colors.warning} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.cardTitle, { color: colors.textPrimary, textAlign }]}>{t('favorites')}</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.textSecondary, textAlign }]}>
                                    {favoriteLocations.length}/{MAX_FAVORITES}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.addFavoriteBtn,
                                { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
                                isFavoritesFull && styles.disabled,
                            ]}
                            onPress={() => openPicker('favorite')}
                            disabled={isFavoritesFull || savingType === 'favorite'}
                        >
                            {savingType === 'favorite' ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Plus size={16} color={colors.primary} />
                            )}
                            <Text style={[styles.actionText, { color: colors.primary }]}>{t('addFavorite')}</Text>
                        </TouchableOpacity>
                    </View>

                    {isFavoritesFull && (
                        <Text style={[styles.limitText, { color: colors.warning, textAlign }]}>{t('favoritesLimitReached')}</Text>
                    )}

                    {favoriteLocations.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textMuted, textAlign }]}>{t('noFavoritesSaved')}</Text>
                    ) : (
                        <View style={styles.favoriteList}>
                            {favoriteLocations.map((favorite) => (
                                <View key={favorite.id || `${favorite.lat}-${favorite.lng}`} style={[styles.favoriteItem, { borderColor: colors.border }]}>
                                    <Text style={[styles.favoriteName, { color: colors.textPrimary, textAlign }]} numberOfLines={1}>{favorite.name}</Text>
                                    <Text style={[styles.favoriteAddress, { color: colors.textSecondary, textAlign }]} numberOfLines={2}>{favorite.address}</Text>

                                    <View style={[styles.actionsRow, { flexDirection }]}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight }]}
                                            onPress={() => openPicker('favorite', favorite)}
                                        >
                                            <Pencil size={14} color={colors.primary} />
                                            <Text style={[styles.actionText, { color: colors.primary }]}>{t('updateLocation')}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionBtn, { borderColor: colors.danger, backgroundColor: isDark ? 'rgba(248,113,113,0.15)' : '#FEF2F2' }]}
                                            onPress={() => handleDelete(favorite)}
                                            disabled={deletingId === favorite.id}
                                        >
                                            {deletingId === favorite.id ? (
                                                <ActivityIndicator size="small" color={colors.danger} />
                                            ) : (
                                                <>
                                                    <Trash2 size={14} color={colors.danger} />
                                                    <Text style={[styles.actionText, { color: colors.danger }]}>{t('delete')}</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        padding: 16,
        gap: 14,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    card: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        gap: 10,
    },
    rowBetween: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowStart: {
        flex: 1,
        alignItems: 'center',
        gap: 10,
    },
    iconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    cardSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    actionsRow: {
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    actionBtn: {
        minHeight: 36,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '700',
    },
    addFavoriteBtn: {
        minHeight: 36,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    disabled: {
        opacity: 0.5,
    },
    limitText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 13,
        marginTop: 6,
    },
    favoriteList: {
        gap: 10,
        marginTop: 4,
    },
    favoriteItem: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        gap: 8,
    },
    favoriteName: {
        fontSize: 14,
        fontWeight: '700',
    },
    favoriteAddress: {
        fontSize: 12,
    },
});
