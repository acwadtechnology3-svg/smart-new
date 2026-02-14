import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform, LayoutAnimation, UIManager, I18nManager } from 'react-native';
import { ArrowLeft, MessageCircle, FileText, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpScreen() {
    const navigation = useNavigation<any>();
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    // RTL Logic
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';
    const iconMargin = isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16, marginLeft: 0 };

    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    const toggleFaq = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedFaq(expandedFaq === index ? null : index);
    };

    const FAQS = [
        {
            q: t('faqPayment') || 'How to pay for a trip?',
            a: t('faqPaymentAns') || 'You can pay using Cash or your SmartLine Wallet. Select your preferred payment method on the trip confirmation screen before booking.'
        },
        {
            q: t('faqCancel') || 'How to cancel a ride?',
            a: t('faqCancelAns') || 'You can cancel a ride by tapping the "Cancel" button on the bottom of the trip screen. Please note that cancellation fees may apply if the driver has already arrived.'
        },
        {
            q: t('faqSafety') || 'Safety concerns',
            a: t('faqSafetyAns') || 'Your safety is our priority. You can share your trip status with friends/family or use the SOS button for emergencies during any active trip.'
        },
        {
            q: t('faqAccount') || 'Account issues',
            a: t('faqAccountAns') || 'For account updates, visit Settings > Personal Information. If you are having trouble logging in or need to change your number, please contact support via chat.'
        }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { flexDirection, backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={colors.textPrimary} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('helpCenter') || 'Help Center'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { textAlign, color: colors.textSecondary }]}>{t('howCanWeHelp') || 'How can we help you?'}</Text>

                <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                    <TouchableOpacity
                        style={[styles.row, { flexDirection }]}
                        onPress={() => navigation.navigate('CustomerSupportChat')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: colors.surfaceHighlight }, iconMargin]}>
                            <MessageCircle size={24} color={colors.primary} />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={[styles.rowTitle, { textAlign, color: colors.textPrimary }]}>{t('chatWithSupport') || 'Chat with Support'}</Text>
                            <Text style={[styles.rowSub, { textAlign, color: colors.textSecondary }]}>{t('startConversation') || 'Start a conversation now'}</Text>
                        </View>
                        <ChevronRight size={20} color={colors.textMuted} style={{ transform: isRTL ? [{ rotate: '180deg' }] : [] }} />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, { textAlign, color: colors.textSecondary }]}>{t('faqs') || 'Frequently Asked Questions'}</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                    {FAQS.map((item, index) => (
                        <View key={index}>
                            <TouchableOpacity
                                style={[styles.faqRow, { flexDirection }]}
                                onPress={() => toggleFaq(index)}
                                activeOpacity={0.7}
                            >
                                <FileText size={18} color={colors.textSecondary} />
                                <Text style={[styles.faqText, { textAlign, color: colors.textPrimary }]}>{item.q}</Text>
                                {expandedFaq === index ? (
                                    <ChevronDown size={16} color={colors.textSecondary} />
                                ) : (
                                    <ChevronRight size={16} color={colors.textMuted} style={{ transform: isRTL ? [{ rotate: '180deg' }] : [] }} />
                                )}
                            </TouchableOpacity>

                            {/* Expandable Content */}
                            {expandedFaq === index && (
                                <View style={styles.faqContent}>
                                    <Text style={[styles.faqAnswer, { textAlign, color: colors.textSecondary }]}>{item.a}</Text>
                                </View>
                            )}

                            {index < FAQS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 12 },
    card: { borderRadius: 16, padding: 16, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    row: { alignItems: 'center', paddingVertical: 12 },
    iconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, paddingHorizontal: 10 },
    rowTitle: { fontSize: 16, fontWeight: 'bold' },
    rowSub: { fontSize: 13 },
    divider: { height: 1, marginVertical: 8 },
    faqRow: { alignItems: 'center', paddingVertical: 16, gap: 12 },
    faqText: { flex: 1, fontSize: 15, fontWeight: '500', marginHorizontal: 12 },
    faqContent: { paddingBottom: 16, paddingHorizontal: 12 },
    faqAnswer: { fontSize: 14, lineHeight: 20 },
});
