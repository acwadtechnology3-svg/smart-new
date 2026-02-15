import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Dimensions, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { ArrowLeft, MapPin, Calendar, CircleDollarSign } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../../services/backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text';
import { Card } from '../../components/ui/Card';

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const { width } = Dimensions.get('window');

export default function DriverHistoryScreen() {
    const navigation = useNavigation<any>();
    const { t, isRTL } = useLanguage();
    const { colors, spacing, radius, shadow } = useTheme();
    const [trips, setTrips] = useState<any[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            const cached = await AsyncStorage.getItem('driver_trips_cache');
            if (cached) {
                setTrips(JSON.parse(cached));
            }
        } catch (e) {
            // ignore
        }
        fetchTrips();
    };

    const fetchTrips = async () => {
        try {
            const data = await apiRequest<{ trips: any[] }>('/trips/driver/history');
            if (data.trips) {
                setTrips(data.trips);
                AsyncStorage.setItem('driver_trips_cache', JSON.stringify(data.trips));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isCompleted = item.status === 'completed';

        // Dynamic Styles for RTL
        const rowStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' } as any;
        const textStyle = { textAlign: isRTL ? 'right' : 'left' } as any;
        const connectorStyle = isRTL ? { marginRight: 4, marginLeft: 0 } : { marginLeft: 4, marginRight: 0 };
        const dotMargin = isRTL ? { marginLeft: 12, marginRight: 0 } : { marginRight: 12, marginLeft: 0 };

        return (
            <Card style={{ marginBottom: spacing.m, backgroundColor: colors.surface }}>
                <View style={[styles.cardHeader, rowStyle]}>
                    <Text variant="caption" style={{ color: colors.textSecondary }}>{formatDate(item.date || item.created_at || new Date().toISOString())}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: isCompleted ? colors.success + '20' : colors.danger + '20' }]}>
                        <Text variant="small" style={{ color: isCompleted ? colors.success : colors.danger, fontWeight: 'bold' }}>
                            {isCompleted ? t('completed').toUpperCase() : t('cancelled').toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={[styles.locationRow, rowStyle]}>
                    <View style={[styles.dot, { backgroundColor: colors.primary, ...dotMargin }]} />
                    <Text variant="body" style={{ color: colors.textPrimary, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{item.pickup || item.pickup_address || t('pickup')}</Text>
                </View>

                <View style={[styles.connectorLine, { backgroundColor: colors.border }, connectorStyle]} />

                <View style={[styles.locationRow, rowStyle]}>
                    <View style={[styles.dot, { backgroundColor: colors.secondary, ...dotMargin }]} />
                    <Text variant="body" style={{ color: colors.textPrimary, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{item.dropoff || item.dest_address || t('dropoff')}</Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={[styles.cardFooter, rowStyle]}>
                    <Text variant="body" style={{ color: colors.textSecondary }}>{t('earnings')}</Text>
                    <Text variant="h3" style={{ color: colors.primary }}>EGP {item.price}</Text>
                </View>
            </Card>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text variant="h2" style={{ color: colors.textPrimary }}>{t('tripHistory')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={trips}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.id || `trip-${index}`}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Calendar size={48} color={Colors.textSecondary} />
                        <Text style={styles.emptyText}>{t('noTrips') || 'No trips yet'}</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },

    listContent: { padding: 20 },
    card: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardHeader: { justifyContent: 'space-between', marginBottom: 16 },
    date: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    statusText: { fontSize: 10, fontWeight: 'bold' },

    locationRow: { alignItems: 'center', marginVertical: 4 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    locationText: { fontSize: 15, color: '#111827', fontWeight: '500' },
    connectorLine: {
        height: 16, width: 2, backgroundColor: '#E5E7EB',
        marginVertical: 0
    },

    divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

    cardFooter: { justifyContent: 'space-between', alignItems: 'center' },
    priceLabel: { fontSize: 14, color: Colors.textSecondary },
    priceValue: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 12 },
    emptyText: { fontSize: 16, color: Colors.textSecondary }
});
