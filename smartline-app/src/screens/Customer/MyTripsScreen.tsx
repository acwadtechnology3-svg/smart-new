import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import AppHeader from '../../components/AppHeader';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

export default function MyTripsScreen() {
    const navigation = useNavigation();
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<'active' | 'past'>('past');

    const PAST_TRIPS = [
        { id: '1', from: 'Cairo Festival City', to: 'Maadi', price: '45.50', date: 'Yesterday, 2:30 PM', status: 'completed' },
        { id: '2', from: 'Work', to: 'Home', price: '30.00', date: 'Jan 28, 6:00 PM', status: 'cancelled' },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader title={t('myTrips') || 'My Trips'} showBack={true} />

            <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={[styles.tab, activeTab === 'active' && { borderBottomColor: colors.primary }]} onPress={() => setActiveTab('active')}>
                    <Text style={[styles.tabText, activeTab === 'active' ? { color: colors.primary } : { color: colors.textSecondary }]}>{t('active') || 'Active'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'past' && { borderBottomColor: colors.primary }]} onPress={() => setActiveTab('past')}>
                    <Text style={[styles.tabText, activeTab === 'past' ? { color: colors.primary } : { color: colors.textSecondary }]}>{t('past') || 'Past'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {activeTab === 'active' ? (
                    <View style={styles.emptyState}>
                        <Clock size={48} color={colors.textMuted} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('noActiveTrips') || 'No active trips'}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={PAST_TRIPS}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow || '#000' }]}>
                                <View style={[styles.tripHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <Text style={[styles.tripDate, { color: colors.textMuted }]}>{item.date}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? (colors.success + '20') : (colors.danger + '20') }]}>
                                        <Text style={[styles.statusText, { color: item.status === 'completed' ? colors.success : colors.danger }]}>
                                            {item.status === 'completed' ? (t('completed') || 'Completed') : (t('cancelled') || 'Cancelled')}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.tripRoute, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <View style={[styles.dot, { backgroundColor: colors.success, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]} />
                                    <Text style={[styles.address, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{item.from}</Text>
                                </View>
                                <View style={[styles.line, { backgroundColor: colors.border, marginLeft: isRTL ? 0 : 3.5, marginRight: isRTL ? 3.5 : 0 }]} />
                                <View style={[styles.tripRoute, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <View style={[styles.square, { backgroundColor: colors.danger, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }]} />
                                    <Text style={[styles.address, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{item.to}</Text>
                                </View>
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                <Text style={[styles.price, { textAlign: isRTL ? 'left' : 'right', color: colors.textPrimary }]}>{t('currency') || 'EGP'} {item.price}</Text>
                            </View>
                        )}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabs: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: 16, fontWeight: '600' },
    content: { flex: 1, padding: 16 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { marginTop: 16 },
    tripCard: { padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    tripHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    tripDate: { fontSize: 12 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    tripRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    square: { width: 8, height: 8 },
    address: { fontSize: 14 },
    line: { width: 1, height: 12, marginLeft: 3.5, marginBottom: 8 },
    divider: { height: 1, marginVertical: 12 },
    price: { fontSize: 16, fontWeight: 'bold' },
});
