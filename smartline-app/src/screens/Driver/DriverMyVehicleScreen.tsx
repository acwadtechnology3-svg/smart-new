import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Image, ScrollView, Alert, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { ArrowLeft, Car, PenTool, AlertCircle } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../../services/backend';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';

export default function DriverMyVehicleScreen() {
    const navigation = useNavigation<any>();
    const { t, isRTL } = useLanguage();
    const { colors, spacing, radius, shadow } = useTheme();
    const [vehicle, setVehicle] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            const cached = await AsyncStorage.getItem('driver_vehicle_cache');
            if (cached) {
                setVehicle(JSON.parse(cached));
            }
        } catch (e) {
            // ignore cache error
        }
        fetchVehicleData();
    };

    const fetchVehicleData = async () => {
        try {
            const data = await apiRequest<{ driver: any }>('/drivers/me');
            if (data.driver) {
                setVehicle(data.driver);
                AsyncStorage.setItem('driver_vehicle_cache', JSON.stringify(data.driver));
            }
        } catch (e) {
            console.error(e);
            if (!vehicle) setFallbackData();
        }
    };

    const setFallbackData = () => {
        setVehicle({
            vehicle_model: 'Toyota Corolla',
            vehicle_plate: 'ABC 123',
            vehicle_type: 'Sedan',
            vehicle_front_url: null
        });
    };

    const rowStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' } as any;
    const textAlign = { textAlign: isRTL ? 'right' : 'left' } as any;

    if (!vehicle) return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, rowStyle]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }]}>
                    <ArrowLeft size={24} color="#1e1e1e" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('myVehicle')}</Text>
                <View style={{ width: 24 }} />
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text>{t('loadingVehicleInfo')}</Text>
            </View>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, rowStyle, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }]}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text variant="h2" style={{ color: colors.textPrimary }}>{t('myVehicle')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('DriverChangeVehicle')}>
                    <PenTool size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {vehicle.pendingRequest && (
                <View style={[styles.statusBanner, { backgroundColor: vehicle.pendingRequest.status === 'rejected' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Text style={[styles.statusBannerText, { color: vehicle.pendingRequest.status === 'rejected' ? '#DC2626' : '#D97706', textAlign: 'center' }]}>
                        {vehicle.pendingRequest.status === 'rejected'
                            ? `${t('vehicleChangeRejected')}: ${vehicle.pendingRequest.admin_notes || ''}`
                            : t('vehicleChangePending')}
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.content}>

                {/* Vehicle Card */}
                <View style={[styles.vehicleCard, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                    <Image
                        source={{ uri: vehicle.vehicle_front_url || 'https://via.placeholder.com/400x200?text=No+Photo' }}
                        style={styles.vehicleImage}
                        resizeMode="cover"
                    />
                    <View style={styles.vehicleInfo}>
                        <Text variant="h2" style={{ color: colors.textPrimary, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{vehicle.vehicle_model}</Text>
                        <Text variant="body" style={{ color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>{vehicle.vehicle_plate}</Text>

                        <View style={[styles.typeBadge, { alignSelf: isRTL ? 'flex-end' : 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.primary + '15' }]}>
                            <Car size={14} color={colors.primary} />
                            <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>{vehicle.vehicle_type}</Text>
                        </View>
                    </View>
                </View>

                {/* Documents Status */}
                <Text variant="h3" style={{ color: colors.textPrimary, marginBottom: spacing.m, textAlign: isRTL ? 'right' : 'left' }}>{t('documentsStatus')}</Text>
                <View style={[styles.docList, { backgroundColor: colors.surface }]}>
                    <DocumentRow
                        label={t('driverLicense')}
                        status={vehicle.license_front_url ? t('uploaded') : t('missing')}
                        expires={vehicle.license_front_url ? t('viewDocument') : t('uploadRequired')}
                        isWarning={!vehicle.license_front_url}
                        isRTL={isRTL}
                        colors={colors}
                    />
                    <DocumentRow
                        label={t('vehicleLicense')}
                        status={vehicle.vehicle_license_front_url ? t('uploaded') : t('missing')}
                        expires={vehicle.vehicle_license_front_url ? t('viewDocument') : t('uploadRequired')}
                        isWarning={!vehicle.vehicle_license_front_url}
                        isRTL={isRTL}
                        colors={colors}
                    />
                    <DocumentRow
                        label={t('nationalID')}
                        status={vehicle.id_front_url ? t('uploaded') : t('missing')}
                        expires={vehicle.id_front_url ? t('viewDocument') : t('uploadRequired')}
                        isWarning={!vehicle.id_front_url}
                        isRTL={isRTL}
                        colors={colors}
                    />
                </View>

                {/* Info Note */}
                <Button
                    title={t('requestVehicleChange')}
                    onPress={() => navigation.navigate('DriverChangeVehicle')}
                    leftIcon={PenTool}
                    style={{ marginTop: spacing.l, marginBottom: spacing.xl }}
                />

            </ScrollView>
        </SafeAreaView>
    );
}

const DocumentRow = ({ label, status, expires, isWarning, isRTL, colors }: any) => (
    <View style={[styles.docRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: colors.border }]}>
        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text variant="body" weight="600" style={{ color: colors.textPrimary }}>{label}</Text>
            <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{expires}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isWarning ? colors.warning + '20' : colors.success + '20' }]}>
            <Text variant="small" style={{ color: isWarning ? colors.warning : colors.success, fontWeight: 'bold' }}>{status}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
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
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },

    content: { padding: 20 },

    vehicleCard: {
        backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
    },
    vehicleImage: { width: '100%', height: 200 },
    vehicleInfo: { padding: 20 },
    modelName: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    plateNumber: { fontSize: 16, color: Colors.textSecondary, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 12 },
    typeBadge: {
        alignItems: 'center', gap: 6,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20
    },
    typeText: { color: '#4F46E5', fontWeight: '600', fontSize: 12 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },

    docList: { backgroundColor: '#fff', borderRadius: 16, padding: 8, marginBottom: 24 },
    docRow: {
        justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
    },
    docLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
    docExpiry: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '600' },

    statusBanner: { padding: 12, alignItems: 'center', justifyContent: 'center' },
    statusBannerText: { fontSize: 14, fontWeight: 'bold' },
    actionButton: {
        backgroundColor: Colors.primary, padding: 16, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 40
    },
    actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
