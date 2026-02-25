import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, Image, ImageSourcePropType, Switch } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { Flag, ArrowLeft } from 'lucide-react-native';

type DriverVehicleScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DriverVehicle'>;
type DriverVehicleScreenRouteProp = RouteProp<RootStackParamList, 'DriverVehicle'>;

import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

export default function DriverVehicleScreen() {
    const navigation = useNavigation<DriverVehicleScreenNavigationProp>();
    const route = useRoute<DriverVehicleScreenRouteProp>();
    const { phone, name, nationalId, city } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'taxi' | null>(null);
    const [vehicleModel, setVehicleModel] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [isTravelCaptain, setIsTravelCaptain] = useState(false);

    // Reset Travel Captain if changing away from car
    React.useEffect(() => {
        if (vehicleType !== 'car') {
            setIsTravelCaptain(false);
        }
    }, [vehicleType]);

    const handleNext = () => {
        if (!vehicleType || !vehicleModel || !vehiclePlate) {
            Alert.alert(t('error'), t('pleaseFillAllFields'));
            return;
        }

        navigation.navigate('DriverProfilePhoto', {
            phone,
            name,
            nationalId,
            city,
            vehicleType,
            vehicleModel,
            vehiclePlate,
            isTravelCaptain,
        });
    };

    const renderVehicleCard = (type: 'car' | 'motorcycle' | 'taxi', label: string, imageSource: ImageSourcePropType) => (
        <TouchableOpacity
            style={[
                styles.vehicleCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                vehicleType === type && styles.vehicleCardSelected,
            ]}
            onPress={() => setVehicleType(type)}
        >
            <Image
                source={imageSource}
                style={[
                    styles.vehicleImage,
                    vehicleType === type ? { opacity: 1 } : { opacity: 0.5 }
                ]}
                resizeMode="contain"
            />
            <Text style={[
                styles.vehicleLabel,
                { color: colors.textSecondary },
                vehicleType === type && styles.vehicleLabelSelected
            ]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    <ArrowLeft size={28} color={Colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('changeVehicle')}</Text>
                <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('step')} 2 {t('of')} 4</Text>

                <View style={[styles.vehiclesContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {renderVehicleCard('taxi', t('taxi'), require('../../../سمارت لاين ايقون/taxi.webp'))}
                    {renderVehicleCard('motorcycle', t('motorcycle'), require('../../../سمارت لاين ايقون/scooter.webp'))}
                    {renderVehicleCard('car', t('car'), require('../../../سمارت لاين ايقون/vip.webp'))}
                </View>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('vehicleModel')}</Text>
                    <TextInput
                        style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                        placeholder="e.g. Nissan Sunny 2024"
                        placeholderTextColor={colors.textMuted}
                        value={vehicleModel}
                        onChangeText={setVehicleModel}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('vehiclePlate')}</Text>
                    <TextInput
                        style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                        placeholder="e.g. ABC 123"
                        placeholderTextColor={colors.textMuted}
                        value={vehiclePlate}
                        onChangeText={setVehiclePlate}
                    />
                </View>

                {vehicleType === 'car' && (
                    <View style={[styles.inputContainer, { marginBottom: 32 }]}>
                        <View style={{
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 12,
                            borderWidth: 1,
                            borderColor: isTravelCaptain ? Colors.primary : Colors.border,
                            borderRadius: 8,
                            backgroundColor: isTravelCaptain ? '#F0F9FF' : '#fff'
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: isRTL ? 'right' : 'left' }}>Apply as Travel Captain</Text>
                                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>Receive long-distance intercity requests (50km range)</Text>
                            </View>
                            <Switch
                                value={isTravelCaptain}
                                onValueChange={setIsTravelCaptain}
                                trackColor={{ false: '#ccc', true: Colors.primary }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    </View>
                )}

                <TouchableOpacity style={styles.button} onPress={handleNext}>
                    <Text style={styles.buttonText}>{t('nextProfilePhoto')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { padding: 16 },
    backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
    content: { padding: 24, paddingTop: 0 },
    title: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 32 },
    vehiclesContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, gap: 10 },
    vehicleCard: { flex: 1, height: 140, backgroundColor: Colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8, borderWidth: 1.5, borderColor: Colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    vehicleCardSelected: { borderColor: Colors.primary, backgroundColor: '#F0F9FF', shadowOpacity: 0.1, shadowColor: Colors.primary },
    vehicleImage: { width: 100, height: 65, marginBottom: 12 },
    vehicleLabel: { marginTop: 8, fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
    vehicleLabelSelected: { color: Colors.primary },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 16, fontSize: 16, backgroundColor: Colors.surface, color: Colors.textPrimary },
    button: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
