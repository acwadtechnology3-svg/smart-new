import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Image, Platform, Keyboard, TouchableWithoutFeedback, I18nManager } from 'react-native';
import { Tag, Ticket, Copy, Check, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../../services/backend';
import { useLanguage } from '../../context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme/useTheme';

const CACHE_KEY = 'cached_promos';

export default function DiscountsScreen() {
    const navigation = useNavigation();
    const { t, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    // RTL Layout Logic
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';

    const [promoCode, setPromoCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [promos, setPromos] = useState<any[]>([]);
    const [fetching, setFetching] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        loadPromos();
    }, []);

    const loadPromos = async () => {
        try {
            // 1. Load from cache first
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                setPromos(JSON.parse(cached));
                setFetching(false); // Show cached content immediately
            }

            // 2. Fetch fresh data
            await fetchPromosContext();
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    };

    const fetchPromosContext = async () => {
        try {
            const data = await apiRequest<{ promos: any[] }>('/pricing/available');
            if (data.promos) {
                setPromos(data.promos);
                // Update cache
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data.promos));
            }
        } catch (err) {
            console.log("Error fetching promos", err);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchPromosContext();
        setRefreshing(false);
    }, []);

    const applyPromo = async (code: string) => {
        if (!code.trim()) {
            Alert.alert(t('required'), t('enterPromoCode'));
            return;
        }

        Keyboard.dismiss();
        setLoading(true);
        try {
            // Verify
            const data = await apiRequest<{ promo: any }>(`/pricing/promo?code=${code}`);
            if (data.promo) {
                // Store securely
                await AsyncStorage.setItem('selected_promo', JSON.stringify(data.promo));

                Alert.alert(
                    t('success') || "Success",
                    `${t('promoApplied')} ${data.promo.discount_percent}% ${t('offNextRide')}`,
                    [
                        {
                            text: t('bookNow') || "Book Now",
                            onPress: () => navigation.navigate('CustomerHome' as never),
                            style: 'default'
                        }
                    ]
                );
                setPromoCode('');
            }
        } catch (error: any) {
            Alert.alert(t('error'), error.message || t('invalidCode'));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (code: string, id: string) => {
        // await Clipboard.setStringAsync(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const renderPromo = ({ item, index }: { item: any, index: number }) => (
        <View style={[styles.card, { flexDirection, backgroundColor: colors.surface, shadowColor: colors.shadow || '#000', borderColor: colors.border }]}>
            {/* Left Decorator */}
            <View style={styles.cardLeftDecor}>
                <View style={[styles.circleCutoutTop, { backgroundColor: colors.background }]} />
                <View style={[styles.dashedLine, { borderColor: colors.border }]} />
                <View style={[styles.circleCutoutBottom, { backgroundColor: colors.background }]} />
            </View>

            {/* Content */}
            <View style={[styles.cardContent, {
                flexDirection,
                paddingLeft: isRTL ? 16 : 24,
                paddingRight: isRTL ? 24 : 16
            }]}>
                <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                    <Text style={[styles.cardTitle, { color: colors.primary }]}>{item.discount_percent}% OFF</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {t('maxDiscount')} {item.discount_max} {t('currency')}
                    </Text>
                    <View style={[styles.codeContainer, { flexDirection, backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.codeText, { color: colors.textPrimary }]}>{item.code}</Text>
                        <TouchableOpacity onPress={() => copyToClipboard(item.code, item.id)}>
                            {copiedId === item.id ? (
                                <Check size={16} color={colors.success} style={[isRTL ? { marginRight: 8 } : { marginLeft: 8 }]} />
                            ) : (
                                <Copy size={16} color={colors.textMuted} style={[isRTL ? { marginRight: 8 } : { marginLeft: 8 }]} />
                            )}
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.expiryText, { color: colors.textMuted }]}>
                        {t('validUntil')} {new Date(item.valid_until).toLocaleDateString()}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.applyBtnSmall, { backgroundColor: colors.primary + '11', borderColor: colors.primary + '33' }]}
                    onPress={() => applyPromo(item.code)}
                >
                    <Text style={[styles.applyBtnSmallText, { color: colors.primary }]}>{t('use')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ArrowLeft size={24} color={colors.textPrimary} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('promoCodes')}</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Input Section */}
            <View style={[styles.inputSection, { backgroundColor: colors.surface, shadowColor: colors.shadow || '#000' }]}>
                <View style={[styles.inputWrapper, { flexDirection, backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ticket size={20} color={colors.textMuted} style={{ marginHorizontal: 12 }} />
                    <TextInput
                        style={[styles.input, { textAlign, color: colors.textPrimary }]}
                        placeholder={t('enterPromoCode')}
                        value={promoCode}
                        onChangeText={setPromoCode}
                        autoCapitalize="characters"
                        placeholderTextColor={colors.textMuted}
                    />
                    <TouchableOpacity
                        style={[styles.applyButton, { opacity: promoCode ? 1 : 0.6, backgroundColor: colors.primary }]}
                        onPress={() => applyPromo(promoCode)}
                        disabled={!promoCode || loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            isRTL ? <ArrowLeft size={20} color="#fff" /> : <ArrowRight size={20} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listContainer}>
                <Text style={[styles.sectionTitle, { textAlign, color: colors.textPrimary }]}>
                    {t('activePromotions')}
                </Text>

                {fetching && promos.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={promos}
                        keyExtractor={item => item.id || item.code}
                        renderItem={renderPromo}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Image
                                    source={{ uri: 'https://cdn-icons-png.flaticon.com/512/612/612803.png' }} // Fallback or local asset
                                    style={{ width: 80, height: 80, opacity: 0.5, marginBottom: 16 }}
                                />
                                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>{t('noActivePromos')}</Text>
                                <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>{t('checkBackLater')}</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },

    inputSection: {
        padding: 20,
        marginBottom: 10,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 5,
        elevation: 3
    },
    inputWrapper: {
        borderRadius: 12,
        height: 54,
        alignItems: 'center',
        borderWidth: 1,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        fontWeight: '600'
    },
    applyButton: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 5,
        marginLeft: 5
    },

    listContainer: { flex: 1, padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },

    // Card Styles
    card: {
        borderRadius: 16,
        marginBottom: 16,
        height: 140,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
        borderWidth: 1,
    },
    cardLeftDecor: {
        width: 0, // Visual only via decoration
    },
    circleCutoutTop: {
        position: 'absolute', top: -10, left: -10,
        width: 20, height: 20, borderRadius: 10, zIndex: 10
    },
    circleCutoutBottom: {
        position: 'absolute', bottom: -10, left: -10,
        width: 20, height: 20, borderRadius: 10, zIndex: 10
    },
    dashedLine: {
        position: 'absolute', top: 20, bottom: 20, left: 0,
        width: 1, borderStyle: 'dashed', borderWidth: 1, zIndex: 5
    },
    cardContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTitle: { fontSize: 24, fontWeight: '800' },
    cardSubtitle: { fontSize: 13, marginTop: 4 },
    codeContainer: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    codeText: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
    expiryText: { fontSize: 11, marginTop: 12 },

    applyBtnSmall: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DBEAFE'
    },
    applyBtnSmallText: { fontSize: 13, fontWeight: '700' },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
    emptySubtext: { fontSize: 14, color: '#9CA3AF' }
});
