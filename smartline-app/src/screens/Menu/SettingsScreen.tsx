import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Globe, ChevronRight, Trash2, Moon, Sun, Smartphone } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../../services/backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { StatusBar } from 'expo-status-bar';

export default function SettingsScreen() {
    const navigation = useNavigation();
    const { t, language, setLanguage, isRTL } = useLanguage();
    const { colors, mode, setMode, resolvedScheme } = useTheme();
    const isDark = resolvedScheme === 'dark';

    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        loadSettings(true);
    }, []);

    const loadSettings = async (withLoading = false) => {
        try {
            // 1. Try to load from cache first for instant UI
            const session = await AsyncStorage.getItem('userSession');
            if (session) {
                const { user: cachedUser } = JSON.parse(session);
                if (cachedUser) {
                    setUser(cachedUser);
                }
            }

            if (withLoading && !user) setLoading(true);

            // 2. Fetch latest data from server
            const data = await apiRequest<{ user: any }>('/users/me');
            if (data?.user) {
                setUser(data.user);
                // Background update cache
                if (session) {
                    const parsed = JSON.parse(session);
                    await AsyncStorage.setItem('userSession', JSON.stringify({ ...parsed, user: data.user }));
                }

            }
        } catch (error: any) {
            if (error?.code !== 'AUTH_SIGNED_OUT') {
                console.error('Failed to load settings:', error);
            }
            // If fetch failed, we already have cached data in 'user' state if available
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            t('deleteAccount'),
            t('deleteAccountConfirm'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('delete'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await apiRequest('/users/account', { method: 'DELETE' });
                            await AsyncStorage.multiRemove(['userSession', 'token']);
                            Alert.alert(t('success'), t('accountDeleted'));
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'SplashScreen' as never }],
                            });
                        } catch (error: any) {
                            const msg = error?.response?.data?.error || t('deleteAccountFailed');
                            Alert.alert(t('error'), msg);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading && !user) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#1e1e1e" />
            </SafeAreaView>
        );
    }

    // Determine effective layout direction
    // If we are Simulating (isRTL != NativeRTL), we flip.
    // If not simulating (Native Matches Context), we use 'row'.
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';

    const rowStyle = { flexDirection } as any;
    const paddingStyle = isRTL ? { marginRight: 0, marginLeft: 12 } : { marginRight: 12, marginLeft: 0 };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <StatusBar style={isDark ? "light" : "dark"} />

            <View style={[styles.header, { flexDirection, backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <Text style={[styles.sectionHeader, { textAlign, color: colors.textSecondary }]}>{t('account')}</Text>
                <View style={[styles.groupContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <SettingItem
                        icon={<User size={20} color="#3B82F6" />}
                        label={t('personalInfo')}
                        onPress={() => navigation.navigate('PersonalInformation' as never)}
                        isRTL={isRTL}
                        flexDirection={flexDirection}
                        colors={colors}
                    />
                </View>

                {/* Appearance Section */}
                <Text style={[styles.sectionHeader, { textAlign, color: colors.textSecondary }]}>{t('appearance') || 'Appearance'}</Text>
                <View style={[styles.groupContainer, { backgroundColor: colors.surface, borderColor: colors.border, padding: 16 }]}>
                    <View style={[styles.row, { padding: 0, marginBottom: 16 }]}>
                        <View style={[styles.rowLeft, rowStyle]}>
                            <View style={[styles.iconBox, paddingStyle, { backgroundColor: colors.background }]}>
                                {mode === 'dark' ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
                            </View>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('theme') || 'Theme'}</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, padding: 4, borderRadius: 12 }}>
                        {(['system', 'light', 'dark'] as const).map((m) => {
                            const isActive = mode === m;
                            return (
                                <TouchableOpacity
                                    key={m}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isActive ? colors.surface : 'transparent',
                                        borderRadius: 8,
                                        shadowColor: isActive ? '#000' : undefined,
                                        shadowOpacity: isActive ? 0.1 : 0,
                                        elevation: isActive ? 2 : 0,
                                        borderWidth: 1,
                                        borderColor: isActive ? colors.border : 'transparent'
                                    }}
                                    onPress={() => setMode(m)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        {m === 'system' && <Smartphone size={14} color={isActive ? colors.textPrimary : colors.textMuted} />}
                                        {m === 'light' && <Sun size={14} color={isActive ? colors.textPrimary : colors.textMuted} />}
                                        {m === 'dark' && <Moon size={14} color={isActive ? colors.textPrimary : colors.textMuted} />}
                                        <Text style={{
                                            color: isActive ? colors.textPrimary : colors.textMuted,
                                            fontWeight: isActive ? '600' : '500',
                                            fontSize: 14
                                        }}>
                                            {m === 'system' ? (t('system') || 'System') : (m === 'light' ? (t('light') || 'Light') : (t('dark') || 'Dark'))}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                <Text style={[styles.sectionHeader, { textAlign, color: colors.textSecondary }]}>{t('preferences')}</Text>
                <View style={[styles.groupContainer, { paddingBottom: 16, backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* Improved Language Selection UI */}
                    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                        <View style={[rowStyle, { alignItems: 'center', marginBottom: 12 }]}>
                            <View style={[styles.iconBox, paddingStyle, { backgroundColor: colors.background }]}>
                                <Globe size={20} color="#F59E0B" />
                            </View>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('language')}</Text>
                        </View>

                        <View style={[styles.langSelector, rowStyle, { backgroundColor: colors.background }]}>
                            <TouchableOpacity
                                style={[styles.langOption, language === 'en' && { backgroundColor: colors.surface, ...colors.shadow ? {} : styles.langOptionActive }]}
                                onPress={() => setLanguage('en')}
                            >
                                <Text style={[styles.langText, language === 'en' && { color: colors.textPrimary }]}>English</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.langOption, language === 'ar' && { backgroundColor: colors.surface, ...colors.shadow ? {} : styles.langOptionActive }]}
                                onPress={() => setLanguage('ar')}
                            >
                                <Text style={[styles.langText, language === 'ar' && { color: colors.textPrimary }, { fontFamily: 'Outfit' }]}>العربية</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.dangerZone}>
                    <TouchableOpacity style={[
                        styles.deleteBtn,
                        { flexDirection }
                    ]} onPress={handleDeleteAccount}>
                        <Trash2 size={20} color="#DC2626" />
                        <Text style={styles.deleteText}>{t('deleteAccount')}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.versionText}>{t('version')} 1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const SettingItem = ({ icon, label, value, onPress, isRTL, flexDirection, colors }: { icon: any, label: string, value?: string, onPress?: () => void, isRTL: boolean, flexDirection: any, colors: any }) => (
    <TouchableOpacity style={[styles.row, { flexDirection }]} onPress={onPress}>
        <View style={[styles.rowLeft, { flexDirection }]}>
            <View style={[styles.iconBox, isRTL ? { marginLeft: 12 } : { marginRight: 12 }, { backgroundColor: colors.background }]}>
                {icon}
            </View>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        </View>
        <View style={[styles.rowRight, { flexDirection }]}>
            {value && <Text style={[styles.value, isRTL ? { marginLeft: 8 } : { marginRight: 8 }]}>{value}</Text>}
            <View style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }}>
                <ChevronRight size={20} color={colors.textMuted} />
            </View>
        </View>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 20, // SafeAreaView handles the top inset
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    content: { paddingHorizontal: 16, paddingTop: 10 },
    sectionHeader: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 10, marginTop: 20, textTransform: 'uppercase', paddingHorizontal: 10 },
    groupContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: { fontSize: 16, color: '#374151', fontWeight: '600' },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    value: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 64 },
    dangerZone: { marginTop: 10 },
    deleteBtn: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#fff', padding: 16, borderRadius: 16, marginTop: 12, gap: 8,
        borderWidth: 1, borderColor: '#FECACA',
    },
    deleteText: { color: '#DC2626', fontWeight: 'bold', fontSize: 16 },
    versionText: { textAlign: 'center', color: '#9CA3AF', marginTop: 30, marginBottom: 40, fontSize: 12 },

    // Language Selector Styles
    langSelector: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
        gap: 4
    },
    langOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    langOptionActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
    },
    langText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280'
    },
    langTextActive: {
        color: '#111827'
    }
});
