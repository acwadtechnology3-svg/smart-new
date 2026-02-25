import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/Colors';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../theme/useTheme';

type DriverSignupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DriverSignup'>;
type DriverSignupScreenRouteProp = RouteProp<RootStackParamList, 'DriverSignup'>;

import { ArrowLeft } from 'lucide-react-native';

const EG_CITIES = [
    'Cairo', 'Giza', 'Alexandria', 'Sharm El Sheikh', 'Hurghada', 'Luxor', 'Aswan',
    'Mansoura', 'Tanta', 'Zagazig', 'Ismailia', 'Suez', 'Port Said', 'Minya',
    'Assiut', 'Sohag', 'Qena', 'Banha', 'Kafr El Sheikh', 'Damanhur'
];

import { useLanguage } from '../../context/LanguageContext';

export default function DriverSignupScreen() {
    const navigation = useNavigation<DriverSignupScreenNavigationProp>();
    const route = useRoute<DriverSignupScreenRouteProp>();
    const { phone } = route.params;
    const { t, isRTL } = useLanguage();
    const { colors } = useTheme();

    const [nationalId, setNationalId] = useState('');
    const [city, setCity] = useState(EG_CITIES[0]);

    const handleNext = () => {
        if (!nationalId || !city) {
            Alert.alert(t('error'), t('pleaseFillAllFields'));
            return;
        }
        navigation.navigate('DriverVehicle', {
            phone,
            name: '',
            nationalId,
            city
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header ... */}
            <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    <ArrowLeft size={28} color={Colors.textPrimary} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('personalInfo')}</Text>
                <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('step')} 1 {t('of')} 3</Text>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('nationalIdNumber')}</Text>
                    <TextInput
                        style={[styles.input, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                        placeholder="14 digit ID"
                        placeholderTextColor={colors.textMuted}
                        value={nationalId}
                        onChangeText={setNationalId}
                        keyboardType="numeric"
                        maxLength={14}
                        autoComplete="off"
                        textContentType="none"
                        importantForAutofill="no"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={[styles.label, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('city')}</Text>
                    <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <Picker
                            selectedValue={city}
                            onValueChange={(itemValue: string) => setCity(itemValue)}
                            style={{ direction: isRTL ? 'rtl' : 'ltr', color: colors.textPrimary, backgroundColor: colors.surface }}
                            dropdownIconColor={colors.textPrimary}
                        >
                            {EG_CITIES.map((c) => (
                                <Picker.Item key={c} label={c} value={c} color={Colors.black} />
                            ))}
                        </Picker>
                    </View>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleNext}>
                    <Text style={styles.buttonText}>{t('nextVehicleInfo')}</Text>
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
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: Colors.surface, color: Colors.textPrimary },
    pickerContainer: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface },
    button: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
