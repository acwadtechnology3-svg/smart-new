import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, Linking, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Wallet, CreditCard, ArrowDownLeft, ArrowUpRight, Banknote, X } from 'lucide-react-native';
import { apiRequest } from '../../services/backend';
import { Colors } from '../../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import Constants from 'expo-constants';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const BACKEND_URL = Constants.expoConfig?.hostUri
    ? `http://${Constants.expoConfig.hostUri.split(':').shift()}:3000/api`
    : 'http://192.168.8.103:3000/api';

export default function DriverWalletScreen() {
    const navigation = useNavigation();
    const { t, isRTL } = useLanguage();
    const { colors, spacing, radius, shadow, isDark } = useTheme();

    const [balance, setBalance] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Deposit State
    const [depositModalVisible, setDepositModalVisible] = useState(false);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositing, setDepositing] = useState(false);

    // Withdraw State
    const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState<'wallet' | 'instapay'>('instapay');
    const [withdrawAccount, setWithdrawAccount] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        loadCachedData();
        fetchWalletData();
    }, []);

    const loadCachedData = async () => {
        try {
            const cached = await AsyncStorage.getItem('wallet_data');
            if (cached) {
                const { balance: cachedBalance, transactions: cachedTxs } = JSON.parse(cached);
                setBalance(cachedBalance);
                setTransactions(cachedTxs);
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
            if (!session) return;
            const { user } = JSON.parse(session);
            setUserId(user.id);

            const data = await apiRequest<{ balance: number; transactions: any[] }>('/wallet/summary');
            setBalance(data.balance || 0);
            setTransactions(data.transactions || []);

            await AsyncStorage.setItem('wallet_data', JSON.stringify({
                balance: data.balance || 0,
                transactions: data.transactions || []
            }));

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const pollPaymentVerification = async (orderId: string, attempts = 0) => {
        if (attempts >= 6) return; // Stop after 6 attempts (~2 minutes)
        try {
            const result = await apiRequest<{ verified: boolean; status: string; message: string }>(
                `/payment/verify/${orderId}`
            );
            if (result.verified) {
                Alert.alert(t('success'), 'Payment confirmed! Your balance has been updated.');
                fetchWalletData();
                return;
            }
            // Keep polling
            const delay = attempts < 3 ? 10000 : 20000;
            setTimeout(() => pollPaymentVerification(orderId, attempts + 1), delay);
        } catch (err) {
            console.log('Verify poll error:', err);
        }
    };

    const initiateDeposit = async () => {
        if (!depositAmount || isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
            Alert.alert(t('error'), "Please enter a valid positive amount.");
            return;
        }

        setDepositing(true);
        try {
            const data = await apiRequest<{ paymentUrl: string; orderId: string; sessionId?: string }>('/payment/deposit/init', {
                method: 'POST',
                body: JSON.stringify({ userId, amount: parseFloat(depositAmount) })
            });

            if (data.paymentUrl) {
                Linking.openURL(data.paymentUrl);
                setDepositModalVisible(false);
                setDepositAmount('');
                Alert.alert(t('success'), "Complete payment in your browser. Your balance will update automatically.");
                // Start polling Kashier to verify payment
                setTimeout(() => pollPaymentVerification(data.orderId), 5000);
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert(t('error'), error.message || "Failed to initiate deposit");
        } finally {
            setDepositing(false);
        }
    };

    const requestWithdrawal = async () => {
        if (!withdrawAmount || isNaN(parseFloat(withdrawAmount)) || parseFloat(withdrawAmount) <= 0) {
            Alert.alert(t('error'), "Please enter a valid positive amount.");
            return;
        }
        if (!withdrawAccount) {
            Alert.alert(t('error'), "Please enter your account number/phone.");
            return;
        }

        if (balance !== null && parseFloat(withdrawAmount) > balance) {
            Alert.alert(t('error'), "You cannot withdraw more than your balance.");
            return;
        }

        setWithdrawing(true);
        try {
            const response: any = await apiRequest('/payment/withdraw/request', {
                method: 'POST',
                body: JSON.stringify({
                    amount: parseFloat(withdrawAmount),
                    method: withdrawMethod,
                    accountNumber: withdrawAccount
                })
            });

            // Show bilingual message from backend
            const message = isRTL
                ? (response.message_ar || "تم إرسال طلب السحب بنجاح. سيتم تحويل المبلغ بعد مراجعة الإدارة.")
                : (response.message_en || "Withdrawal request submitted. Funds will be transferred after admin review.");

            Alert.alert(t('success'), message);
            setWithdrawModalVisible(false);
            setWithdrawAmount('');
            setWithdrawAccount('');
            fetchWalletData();

        } catch (error: any) {
            // console.error('Withdrawal request error:', error);
            Alert.alert(t('error'), error.message || "Failed to request withdrawal");
        } finally {
            setWithdrawing(false);
        }
    };

    const renderTransaction = ({ item }: { item: any }) => {
        let statusColor = colors.textSecondary;
        let statusLabel = item.status || 'Completed';
        let icon = <Banknote size={20} color={colors.textSecondary} />;
        let iconBg = colors.surfaceHighlight;

        if (item.status === 'pending') {
            statusColor = colors.warning;
            statusLabel = 'Pending';
        } else if (item.status === 'failed' || item.status === 'rejected' || item.status === 'cancelled') {
            statusColor = colors.danger;
            statusLabel = item.status === 'rejected' ? 'Rejected' : 'Failed';
        } else if (item.status === 'completed' || item.status === 'approved') {
            statusColor = colors.success;
            statusLabel = 'Success';
        }

        if (item.type === 'deposit') {
            icon = <ArrowDownLeft size={20} color={colors.success} />;
            iconBg = isDark ? colors.success + '20' : '#DCFCE7';
        } else if (item.type === 'withdrawal' || item.type === 'withdrawal_request') {
            icon = <ArrowUpRight size={20} color={colors.danger} />;
            iconBg = isDark ? colors.danger + '20' : '#FEE2E2';
        } else if (item.type === 'trip_earnings') {
            icon = <Wallet size={20} color={colors.primary} />;
            iconBg = isDark ? colors.primary + '20' : '#E0E7FF';
        } else if (item.type === 'payment' || item.type === 'fee') {
            icon = <CreditCard size={20} color={colors.warning} />;
            iconBg = isDark ? colors.warning + '20' : '#FEF3C7';
        }

        const isPositive = item.amount > 0;
        const amountColor = isPositive ? colors.success : colors.textPrimary;

        return (
            <Card style={{ marginBottom: spacing.s, padding: spacing.m, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
                <View style={[styles.txIcon, { backgroundColor: iconBg, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]}>
                    {icon}
                </View>
                <View style={[styles.txInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text variant="body" weight="bold" style={{ color: colors.textPrimary }}>
                        {item.type === 'withdrawal_request' ? 'Withdrawal Request' :
                            item.type === 'payment' ? 'Platform Fee' :
                                item.type === 'trip_earnings' ? 'Trip Earnings' :
                                    item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </Text>
                    <Text variant="caption" style={{ color: colors.textSecondary }}>{format(new Date(item.created_at), 'MMM dd, hh:mm a')}</Text>
                </View>
                <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                    <Text variant="body" weight="bold" style={{ color: amountColor }}>
                        {isPositive ? '+' : ''}{item.amount.toFixed(2)} EGP
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </View>
            </Card>
        );
    };

    const rowStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' } as any;
    const textAlign = { textAlign: isRTL ? 'right' : 'left' } as any;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, rowStyle, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text variant="h2" style={{ color: colors.textPrimary }}>{t('wallet')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={[styles.content, { paddingHorizontal: spacing.l }]}>
                {/* Balance Card */}
                <Card style={[styles.balanceCard, balance !== null && balance < -100 ? styles.balanceCardDanger : { backgroundColor: colors.surface }]}>
                    <Text variant="body" style={[styles.balanceLabel, { color: balance !== null && balance < -100 ? '#fff' : colors.textSecondary }]}>{t('currentBalance')}</Text>
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Text variant="h1" style={[styles.balanceValue, { color: balance !== null && balance < -100 ? '#fff' : colors.textPrimary }]}>
                            {balance?.toFixed(2) || '0.00'} <Text variant="h3" style={{ color: balance !== null && balance < -100 ? '#fff' : colors.textPrimary }}>EGP</Text>
                        </Text>
                    )}

                    {balance !== null && balance < -100 && (
                        <View style={styles.blockedBadge}>
                            <Text variant="caption" style={styles.blockedText}>{t('accessBlocked')} ({'>'} 100)</Text>
                        </View>
                    )}
                </Card>

                {/* Actions */}
                <View style={[styles.actionRow, rowStyle]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setDepositModalVisible(true)}>
                        <View style={[styles.actionIconBg, { backgroundColor: colors.primary + '15' }]}>
                            <Wallet size={24} color={colors.primary} />
                        </View>
                        <Text variant="body" style={{ color: colors.textPrimary }}>{t('deposit')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => setWithdrawModalVisible(true)}>
                        <View style={[styles.actionIconBg, { backgroundColor: colors.success + '15' }]}>
                            <Banknote size={24} color={colors.success} />
                        </View>
                        <Text variant="body" style={{ color: colors.textPrimary }}>{t('withdraw') || 'Withdraw'}</Text>
                    </TouchableOpacity>
                </View>

                <Text variant="h3" style={[styles.sectionTitle, textAlign, { color: colors.textPrimary }]}>{t('recentTransactions')}</Text>
                <FlatList
                    data={transactions}
                    keyExtractor={item => item.id}
                    renderItem={renderTransaction}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchWalletData(true)}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>{t('noTransactions')}</Text>}
                />
            </View>

            {/* DEPOSIT MODAL */}
            <Modal visible={depositModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                                <View style={[styles.modalHeader, rowStyle]}>
                                    <Text variant="h2" style={{ color: colors.textPrimary }}>{t('deposit')}</Text>
                                    <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                                        <X size={24} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ marginBottom: spacing.l }}>
                                    <Input
                                        label="Amount (EGP)"
                                        placeholder="e.g. 200"
                                        keyboardType="numeric"
                                        value={depositAmount}
                                        onChangeText={setDepositAmount}
                                    />
                                </View>

                                <Button
                                    title={t('deposit')}
                                    onPress={initiateDeposit}
                                    loading={depositing}
                                    disabled={depositing}
                                    size="l"
                                />
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* WITHDRAW MODAL */}
            <Modal visible={withdrawModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                                <View style={[styles.modalHeader, rowStyle]}>
                                    <Text variant="h2" style={{ color: colors.textPrimary }}>{t('withdraw') || 'Withdraw Request'}</Text>
                                    <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                                        <X size={24} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ marginBottom: spacing.m }}>
                                    <Input
                                        label={t('amount') || 'Amount (EGP)'}
                                        placeholder="e.g. 500"
                                        keyboardType="numeric"
                                        value={withdrawAmount}
                                        onChangeText={setWithdrawAmount}
                                    />
                                </View>

                                <Text variant="body" weight="bold" style={{ color: colors.textPrimary, marginBottom: spacing.s, textAlign: isRTL ? 'right' : 'left' }}>{t('method') || 'Method'}</Text>
                                <View style={[styles.methodRow, rowStyle, { marginBottom: spacing.l }]}>
                                    <TouchableOpacity
                                        style={[styles.methodOption, withdrawMethod === 'instapay' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                                        onPress={() => setWithdrawMethod('instapay')}
                                    >
                                        <Text variant="body" style={{ color: withdrawMethod === 'instapay' ? colors.primary : colors.textSecondary, fontWeight: withdrawMethod === 'instapay' ? 'bold' : 'normal' }}>InstaPay</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.methodOption, withdrawMethod === 'wallet' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                                        onPress={() => setWithdrawMethod('wallet')}
                                    >
                                        <Text variant="body" style={{ color: withdrawMethod === 'wallet' ? colors.primary : colors.textSecondary, fontWeight: withdrawMethod === 'wallet' ? 'bold' : 'normal' }}>E-Wallet</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ marginBottom: spacing.xl }}>
                                    <Input
                                        label={t('accountNumber') || 'Account Number / Phone'}
                                        placeholder="e.g. 01xxxxxxxxx or user@instapay"
                                        value={withdrawAccount}
                                        onChangeText={setWithdrawAccount}
                                    />
                                </View>

                                <Button
                                    title={t('submitRequest') || 'Submit Request'}
                                    onPress={requestWithdrawal}
                                    loading={withdrawing}
                                    disabled={withdrawing}
                                    size="l"
                                />
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, // Background handled by ThemeProvider/Global or SafeAreaView wrapper usually, but here we might need to set it on SafeArea
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },

    content: { flex: 1 },

    balanceCard: {
        borderRadius: 20, padding: 24, marginBottom: 24,
        alignItems: 'center'
    },
    balanceCardDanger: {
        backgroundColor: '#EF4444',
    },
    balanceLabel: { marginBottom: 8 },
    balanceValue: { fontSize: 36, fontWeight: 'bold' },

    blockedBadge: {
        marginTop: 12, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12
    },
    blockedText: { color: '#fff', fontWeight: 'bold' },

    actionRow: { justifyContent: 'space-around', marginBottom: 24 },
    actionBtn: { alignItems: 'center' },
    actionIconBg: {
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center', marginBottom: 8
    },

    sectionTitle: { marginBottom: 12 },

    txIcon: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center'
    },
    txInfo: { flex: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },

    methodRow: { flexDirection: 'row', gap: 12 },
    methodOption: {
        flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
        // backgroundColor: '#F9FAFB' // Handled logic in component
    },
});
