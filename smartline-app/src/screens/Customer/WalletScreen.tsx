import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView, ActivityIndicator, Linking, RefreshControl, Platform, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, CreditCard, Banknote, PlusCircle, Wallet as WalletIcon, Check, X, ArrowDownLeft, Wallet } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../services/backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

type PaymentMethod = 'balance' | 'cash' | 'card';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    status: string;
    created_at: string;
    description?: string;
}

function parseBalance(value: unknown): number | null {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
}

function resolveBalance(summaryBalance: number | null, profileBalance: number | null, sessionBalance: number): number {
    // Priority 1: API Summary (most accurate usually)
    if (summaryBalance !== null) return summaryBalance;
    // Priority 2: User Profile (secondary source)
    if (profileBalance !== null) return profileBalance;
    // Priority 3: Session/Cache (fallback)
    return sessionBalance || 0;
}

function hasReliableBalanceSource(summaryBalance: number | null, profileBalance: number | null, sessionBalance: number): boolean {
    return summaryBalance !== null || profileBalance !== null;
}

export default function WalletScreen() {
    const navigation = useNavigation();
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    // RTL Layout Logic
    const isSimulating = isRTL !== I18nManager.isRTL;
    const flexDirection = isSimulating ? 'row-reverse' : 'row';
    const textAlign = isRTL ? 'right' : 'left';
    const iconMargin = isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16, marginLeft: 0 };
    const iconMarginSmall = isRTL ? { marginLeft: 12, marginRight: 0 } : { marginRight: 12, marginLeft: 0 };

    const [balance, setBalance] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');

    const [showTopUp, setShowTopUp] = useState(false);
    const [showAddCard, setShowAddCard] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');
    const [toppingUp, setToppingUp] = useState(false);

    // Mock Card Data
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVC, setCardCVC] = useState('');

    useEffect(() => {
        loadCachedData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchWalletData();
        }, [])
    );

    const loadCachedData = async () => {
        try {
            const cached = await AsyncStorage.getItem('customer_wallet_data');
            if (cached) {
                const { balance: cachedBalance, transactions: cachedTxs } = JSON.parse(cached);
                const parsedCachedBalance = parseBalance(cachedBalance);
                setBalance(parsedCachedBalance ?? 0);
                setTransactions(Array.isArray(cachedTxs) ? cachedTxs : []);
            }
        } catch (error) {
            console.error('Error loading cached wallet data:', error);
        }
    };

    const fetchWalletData = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const session = await AsyncStorage.getItem('userSession');
            if (!session) {
                console.warn('No session found in AsyncStorage');
                return;
            }
            const parsedSession = JSON.parse(session);
            const user = parsedSession?.user;

            if (!user || !user.id) {
                console.warn('User object or ID missing in session', user);
                // Try to recover by fetching /users/me if possible (auth token might be valid)
                // But for now, just warn.
            } else {
                setUserId(user.id);
            }

            const sessionBalance = parseBalance(user?.balance) ?? 0;

            const [summaryResult, meResult] = await Promise.allSettled([
                apiRequest<{ balance: number; transactions: Transaction[] }>('/wallet/summary'),
                apiRequest<{ user: any }>('/users/me')
            ]);

            let summaryBalance: number | null = null;
            let summaryTransactions: Transaction[] | null = null;
            if (summaryResult.status === 'fulfilled') {
                summaryBalance = parseBalance(summaryResult.value?.balance);
                summaryTransactions = Array.isArray(summaryResult.value?.transactions) ? summaryResult.value.transactions : [];
            } else {
                console.error('Wallet summary request failed:', summaryResult.reason);
            }

            let profileBalance: number | null = null;
            if (meResult.status === 'fulfilled') {
                profileBalance = parseBalance(meResult.value?.user?.balance);
                await AsyncStorage.setItem('userSession', JSON.stringify({
                    ...parsedSession,
                    user: meResult.value.user || parsedSession.user
                }));
            } else {
                console.error('Failed to refresh /users/me while loading wallet:', meResult.reason);
            }

            const safeBalance = resolveBalance(summaryBalance, profileBalance, sessionBalance);
            const canTrustBalance = hasReliableBalanceSource(summaryBalance, profileBalance, sessionBalance);
            if (canTrustBalance) {
                setBalance(safeBalance);
            }

            if (summaryTransactions !== null) {
                setTransactions(summaryTransactions);
                const nextCachePayload: any = { transactions: summaryTransactions };
                if (canTrustBalance) {
                    nextCachePayload.balance = safeBalance;
                }
                await AsyncStorage.mergeItem('customer_wallet_data', JSON.stringify(nextCachePayload));
            } else {
                if (canTrustBalance) {
                    await AsyncStorage.mergeItem('customer_wallet_data', JSON.stringify({
                        balance: safeBalance
                    }));
                }
            }

        } catch (error: any) {
            console.error('Error fetching wallet data:', error);
            // Show error to user so they know it failed (and don't just see 0 balance)
            if (!isRefresh && !balance) {
                Alert.alert('Connection Error', 'Failed to load wallet data. Please check your connection.');
            }

            try {
                const session = await AsyncStorage.getItem('userSession');
                if (session) {
                    const { user } = JSON.parse(session);
                    const fallbackBalance = parseBalance(user?.balance);
                    // Only use fallback if we have one and we don't have a reliable balance yet
                    if (fallbackBalance !== null && balance === null) setBalance(fallbackBalance);
                }
            } catch (fallbackError) {
                console.error('Failed to apply wallet fallback balance from session:', fallbackError);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const verifyPendingTransactions = async (txs: Transaction[]) => {
        const pending = txs.filter(t => t.type === 'deposit' && t.status === 'pending');
        if (pending.length === 0) return;

        let updated = false;
        // Check sequentially to avoid overwhelming backend/kashier
        for (const tx of pending) {
            try {
                // Determine if we should check this transaction (e.g. created recently)
                // For now, check all pending deposits to accept "lost" ones
                const res = await apiRequest<{ verified: boolean }>(`/payment/verify/${tx.id}`);
                if (res.verified) {
                    updated = true;
                }
            } catch (err) {
                console.log('Auto-verify failed for', tx.id);
            }
        }

        if (updated) {
            fetchWalletData();
        }
    };

    useEffect(() => {
        if (transactions.length > 0) {
            verifyPendingTransactions(transactions);
        }
    }, [transactions.map(t => t.id + t.status).join(',')]); // Only run when tx list/status changes

    const pollPaymentVerification = async (orderId: string, attempts = 0) => {
        if (attempts >= 6) return;
        try {
            const result = await apiRequest<{ verified: boolean; status: string; message: string }>(
                `/payment/verify/${orderId}`
            );
            if (result.verified) {
                Alert.alert('Success', 'Payment confirmed! Your balance has been updated.');
                fetchWalletData();
                return;
            }
            const delay = attempts < 3 ? 10000 : 20000;
            setTimeout(() => pollPaymentVerification(orderId, attempts + 1), delay);
        } catch (err) {
            console.log('Verify poll error:', err);
        }
    };

    const handleTopUp = async () => {
        if (!topUpAmount || isNaN(parseFloat(topUpAmount)) || parseFloat(topUpAmount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
            return;
        }

        setToppingUp(true);
        try {
            const data = await apiRequest<{ paymentUrl: string; orderId: string; sessionId?: string }>('/payment/deposit/init', {
                method: 'POST',
                body: JSON.stringify({ userId, amount: parseFloat(topUpAmount) })
            });

            if (data.paymentUrl) {
                Linking.openURL(data.paymentUrl);
                setShowTopUp(false);
                setTopUpAmount('');
                Alert.alert('Payment Initiated', 'Complete payment in your browser. Your balance will update automatically.');
                setTimeout(() => pollPaymentVerification(data.orderId), 5000);
            }
        } catch (error: any) {
            console.error('Top up error:', error);
            Alert.alert('Error', error.message || 'Failed to initiate top up');
        } finally {
            setToppingUp(false);
        }
    };

    const handleAddCard = () => {
        if (cardNumber.length < 16 || cardExpiry.length < 4 || cardCVC.length < 3) {
            Alert.alert('Invalid Details', 'Please enter valid card information.');
            return;
        }
        setShowAddCard(false);
        setCardNumber('');
        setCardExpiry('');
        setCardCVC('');
        Alert.alert('Success', 'Card added successfully!');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { flexDirection, backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>SmartLine Pay</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchWalletData(true)}
                        colors={[colors.primary]}
                    />
                }
            >

                {/* Balance Section - Click to Top Up */}
                <View style={styles.balanceSection}>
                    <Text style={[styles.balanceLabel, { textAlign, color: colors.textSecondary }]}>{t('totalBalance') || 'Total Balance'}</Text>
                    <TouchableOpacity style={[styles.balanceRow, { flexDirection }]} onPress={() => setShowTopUp(true)}>
                        <View style={{ flexDirection: flexDirection, alignItems: 'baseline', gap: 6 }}>
                            <Text style={[styles.currency, { color: colors.textPrimary }]}>{t('currency') || 'EGP'}</Text>
                            {loading ? (
                                <ActivityIndicator color={colors.textPrimary} />
                            ) : (
                                <Text style={[styles.amount, { color: colors.textPrimary }]}>{(balance ?? 0).toFixed(2)}</Text>
                            )}
                        </View>
                        <View style={[styles.topUpBadge, { backgroundColor: colors.primary }]}>
                            <PlusCircle size={14} color="#fff" />
                            <Text style={styles.topUpText}>{t('topUp') || 'Top Up'}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Divider Line */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={[styles.sectionHeader, { textAlign, color: colors.textSecondary }]}>{t('paymentMethods') || 'Payment Methods'}</Text>

                {/* Payment Methods List */}
                <View style={styles.listContainer}>
                    {/* SmartLine Balance Item */}
                    <TouchableOpacity
                        style={[styles.itemRow, selectedMethod === 'balance' && { backgroundColor: isDark ? colors.surfaceHighlight : '#EFF6FF' }, { flexDirection }]}
                        onPress={() => setSelectedMethod('balance')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: isDark ? colors.surface : '#EFF6FF' }, iconMargin]}>
                            <WalletIcon size={20} color={colors.primary} fill={selectedMethod === 'balance' ? colors.primary : "none"} />
                        </View>
                        <Text style={[styles.itemTitle, { color: selectedMethod === 'balance' ? colors.primary : colors.textPrimary }]}>{t('smartLineBalance') || 'SmartLine Balance'}</Text>
                        <View style={{ flex: 1 }} />
                        {selectedMethod === 'balance' && <Check size={20} color={colors.primary} />}
                    </TouchableOpacity>

                    <View style={[styles.listDivider, { backgroundColor: colors.border }]} />

                    {/* Cash Item */}
                    <TouchableOpacity
                        style={[styles.itemRow, selectedMethod === 'cash' && { backgroundColor: isDark ? colors.surfaceHighlight : '#F9FAFB' }, { flexDirection }]}
                        onPress={() => setSelectedMethod('cash')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }, iconMargin]}>
                            <Banknote size={20} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.itemTitle, { color: selectedMethod === 'cash' ? colors.primary : colors.textPrimary }]}>{t('cash') || 'Cash'}</Text>
                        <View style={{ flex: 1 }} />
                        {selectedMethod === 'cash' && <Check size={20} color={colors.primary} />}
                    </TouchableOpacity>

                    <View style={[styles.listDivider, { backgroundColor: colors.border }]} />

                    {/* Add Card Item */}
                    <TouchableOpacity style={[styles.itemRow, { flexDirection }]} onPress={() => setShowAddCard(true)}>
                        <View style={[styles.iconBox, { backgroundColor: isDark ? colors.surface : '#F0FDF4' }, iconMargin]}>
                            <PlusCircle size={20} color={colors.success} />
                        </View>
                        <View>
                            <Text style={[styles.itemTitle, { textAlign, color: colors.textPrimary }]}>{t('creditDebitCard') || 'Credit / Debit Card'}</Text>
                            <Text style={[styles.itemSubtitle, { textAlign, color: colors.textSecondary }]}>Visa • Mastercard • Meeza</Text>
                        </View>
                        <View style={{ flex: 1 }} />
                        <ChevronRight size={20} color={colors.border} style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
                    </TouchableOpacity>
                </View>

                {/* Transaction History */}
                <View style={{ marginTop: 24 }}>
                    <Text style={[styles.sectionHeader, { textAlign, color: colors.textSecondary }]}>{t('recentTransactions') || 'Recent Transactions'}</Text>
                    {transactions.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 20 }}>{t('noTransactions') || 'No transactions yet'}</Text>
                    ) : (
                        transactions.slice(0, 10).map((tx) => (
                            <View key={tx.id} style={[styles.txCard, { flexDirection, backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                                <View style={[styles.txIcon, { backgroundColor: colors.background }, iconMarginSmall]}>
                                    {tx.type === 'deposit' ? (
                                        <ArrowDownLeft size={20} color={colors.success} />
                                    ) : (
                                        <Wallet size={20} color={colors.primary} />
                                    )}
                                </View>
                                <View style={[styles.txInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                                    <Text style={[styles.txTitle, { color: colors.textPrimary }]}>
                                        {tx.type === 'deposit' ? (t('deposit') || 'Deposit') : tx.type === 'payment' ? (t('payment') || 'Payment') : (t('transaction') || 'Transaction')}
                                    </Text>
                                    <Text style={[styles.txDate, { color: colors.textMuted }]}>{new Date(tx.created_at).toLocaleString()}</Text>
                                </View>
                                <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                                    <Text style={[styles.txAmount, { color: tx.amount > 0 ? colors.success : colors.textPrimary }]}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} {t('currency') || 'EGP'}
                                    </Text>
                                    <View style={[styles.statusBadge, { backgroundColor: (tx.status === 'completed' ? colors.success : tx.status === 'pending' ? colors.warning : colors.danger || '#EF4444') + '20' }]}>
                                        <Text style={[styles.statusText, { color: tx.status === 'completed' ? colors.success : tx.status === 'pending' ? colors.warning : colors.danger || '#EF4444' }]}>
                                            {tx.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* --- TOP UP MODAL --- */}
            <Modal visible={showTopUp} transparent animationType="slide" onRequestClose={() => setShowTopUp(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { flexDirection }]}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('topUpBalance') || 'Top Up Balance'}</Text>
                            <TouchableOpacity onPress={() => setShowTopUp(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.inputLabel, { textAlign, color: colors.textSecondary }]}>{t('enterAmount') || 'Enter Amount'} ({t('currency') || 'EGP'})</Text>
                        <TextInput
                            style={[styles.input, { textAlign, backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={topUpAmount}
                            onChangeText={setTopUpAmount}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: colors.primary }, toppingUp && { opacity: 0.7 }]}
                            onPress={handleTopUp}
                            disabled={toppingUp}
                        >
                            {toppingUp ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={[styles.modalButtonText, { color: "#fff" }]}>{t('confirmTopUp') || 'Confirm Top Up'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- ADD CARD MODAL --- */}
            <Modal visible={showAddCard} transparent animationType="slide" onRequestClose={() => setShowAddCard(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={[styles.modalHeader, { flexDirection }]}>
                            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('addNewCard') || 'Add New Card'}</Text>
                            <TouchableOpacity onPress={() => setShowAddCard(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { textAlign, color: colors.textSecondary }]}>{t('cardNumber') || 'Card Number'}</Text>
                            <TextInput
                                style={[styles.input, { textAlign, backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="0000 0000 0000 0000"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                                value={cardNumber}
                                onChangeText={setCardNumber}
                                maxLength={16}
                            />
                        </View>

                        <View style={{ flexDirection: flexDirection, gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { textAlign, color: colors.textSecondary }]}>{t('expiry') || 'Expiry'}</Text>
                                <TextInput
                                    style={[styles.input, { textAlign, backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="MM/YY"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={cardExpiry}
                                    onChangeText={setCardExpiry}
                                    maxLength={5}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.inputLabel, { textAlign, color: colors.textSecondary }]}>{t('cvc') || 'CVC'}</Text>
                                <TextInput
                                    style={[styles.input, { textAlign, backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                                    placeholder="123"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={cardCVC}
                                    onChangeText={setCardCVC}
                                    maxLength={3}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleAddCard}>
                            <Text style={[styles.modalButtonText, { color: "#fff" }]}>{t('verifyAndAdd') || 'Verify & Add Card'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },

    content: { paddingHorizontal: 24, paddingTop: 10 },

    balanceSection: { marginBottom: 24, marginTop: 8 },
    balanceLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
    balanceRow: { alignItems: 'center', justifyContent: 'space-between' },
    currency: { fontSize: 24, fontWeight: 'bold' },
    amount: { fontSize: 48, fontWeight: 'bold', lineHeight: 56 },
    topUpBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, gap: 4
    },
    topUpText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    divider: { height: 1, marginVertical: 16, borderWidth: 0.5 },

    sectionHeader: { fontSize: 14, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },

    listContainer: { marginTop: 8 },
    itemRow: { alignItems: 'center', paddingVertical: 18, borderRadius: 12, paddingHorizontal: 8 },
    iconBox: { width: 44, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    itemTitle: { fontSize: 16, fontWeight: '600' },
    itemSubtitle: { fontSize: 12, marginTop: 2 },
    listDivider: { height: 1, marginLeft: 60 },

    // Transaction Styles
    txCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: 16, borderRadius: 12, marginBottom: 8,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
    },
    txIcon: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center'
    },
    txInfo: { flex: 1 },
    txTitle: { fontSize: 16, fontWeight: '600' },
    txDate: { fontSize: 12, marginTop: 2 },
    txAmount: { fontSize: 16, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 },
    statusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'capitalize' },

    // Modal Styles
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    modalHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: 12, padding: 16, fontSize: 16
    },
    modalButton: {
        borderRadius: 12, paddingVertical: 16,
        alignItems: 'center', marginTop: 24
    },
    modalButtonText: { fontSize: 16, fontWeight: 'bold' },
});
