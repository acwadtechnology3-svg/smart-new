import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Copy, Share2, Ticket, Users, Gift, TrendingUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme/useTheme';
import { useLanguage } from '../../context/LanguageContext';
import { apiRequest } from '../../services/backend';
import * as Clipboard from 'expo-clipboard';

export default function InviteFriendsScreen() {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLanguage();

    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<{ referralCount: number; totalEarned: number } | null>(null);
    const [copied, setCopied] = useState(false);

    const fetchReferralData = useCallback(async () => {
        try {
            setLoading(true);
            const [codeRes, statsRes] = await Promise.all([
                apiRequest<{ code: string; link: string }>('/referrals/my-code'),
                apiRequest<{ referralCount: number; totalEarned: number }>('/referrals/stats'),
            ]);
            setReferralCode(codeRes.code);
            setStats(statsRes);
        } catch (error: any) {
            if (error?.code !== 'AUTH_SIGNED_OUT') {
                console.error('Failed to load referral data:', error);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReferralData();
    }, [fetchReferralData]);

    const copyToClipboard = async () => {
        if (!referralCode) return;
        try {
            await Clipboard.setStringAsync(referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for environments where expo-clipboard is unavailable
            Alert.alert(t('success'), t('referralCodeCopied'));
        }
    };

    const shareCode = async () => {
        if (!referralCode) return;
        try {
            const message = isRTL
                ? `انضم لسمارت لاين! استخدم كود الدعوة ${referralCode} واحصل على خصم على أول رحلة. حمل التطبيق الآن!`
                : `Join me on SmartLine! Use my referral code ${referralCode} to get a discount on your first trip. Download the app now!`;
            await Share.share({ message });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <StatusBar style={isDark ? "light" : "dark"} />

            <View style={[styles.header, { backgroundColor: colors.surface, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ArrowLeft size={24} color={colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('inviteFriends')}</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.illustrationParams}>
                        <View style={[styles.iconCircle, { backgroundColor: isDark ? colors.surfaceHighlight : '#FFF7ED' }]}>
                            <Ticket size={48} color={isDark ? colors.primary : "#F97316"} />
                        </View>
                        <View style={styles.badge}>
                            <Users size={14} color="#ffffff" />
                            <Text style={styles.badgeText}>{t('referAndEarn')}</Text>
                        </View>
                    </View>

                    <Text style={[styles.mainTitle, { color: colors.textPrimary }]}>{t('referralTitle')}</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {t('referralDescription')}
                    </Text>

                    {/* Stats Section */}
                    {stats && (stats.referralCount > 0 || stats.totalEarned > 0) && (
                        <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Users size={20} color={colors.primary} />
                                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.referralCount || 0}</Text>
                                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('referrals')}</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TrendingUp size={20} color="#10B981" />
                                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalEarned || 0} {t('currency')}</Text>
                                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('totalEarnedRef')}</Text>
                            </View>
                        </View>
                    )}

                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
                        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t('yourReferralCode')}</Text>
                        <TouchableOpacity style={[styles.codeContainer, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={copyToClipboard} activeOpacity={0.7}>
                            <Text style={[styles.codeText, { color: colors.textPrimary }]}>{referralCode || '---'}</Text>
                            <View style={[styles.copyButton, { backgroundColor: copied ? '#10B981' + '20' : colors.surfaceHighlight }]}>
                                <Copy size={18} color={copied ? '#10B981' : colors.primary} />
                                <Text style={[styles.copyText, { color: copied ? '#10B981' : colors.primary }]}>
                                    {copied ? t('copied') : t('copy')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.spacer} />

                    <TouchableOpacity style={styles.shareBtnContainer} onPress={shareCode} activeOpacity={0.8}>
                        <LinearGradient
                            colors={isDark ? [colors.primary, '#1d4ed8'] : ['#3B82F6', '#2563EB']}
                            style={styles.shareBtnGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Share2 size={20} color="#fff" style={styles.shareIcon} />
                            <Text style={styles.shareBtnText}>{t('shareCode')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
    },
    illustrationParams: {
        marginTop: 10,
        marginBottom: 20,
        alignItems: 'center',
        position: 'relative',
    },
    iconCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#ffffff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    badge: {
        position: 'absolute',
        bottom: -4,
        backgroundColor: '#F97316',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    badgeText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    mainTitle: {
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 10,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    statsRow: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    card: {
        width: '100%',
        borderRadius: 20,
        padding: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
    },
    cardLabel: {
        fontSize: 12,
        marginBottom: 12,
        fontWeight: '700',
        letterSpacing: 1,
        textAlign: 'center',
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    codeText: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 1,
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    copyText: {
        fontSize: 14,
        fontWeight: '600',
    },
    spacer: {
        flex: 1,
    },
    shareBtnContainer: {
        width: '100%',
        elevation: 8,
        marginTop: 20,
    },
    shareBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
    },
    shareIcon: {
        marginRight: 10,
    },
    shareBtnText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
