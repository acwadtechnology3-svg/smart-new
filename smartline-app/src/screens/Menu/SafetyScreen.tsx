import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { ShieldAlert, PhoneCall, ChevronRight, AlertTriangle } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { RootStackParamList } from '../../types/navigation';
import { apiRequest } from '../../services/backend';
import { tripStatusService } from '../../services/tripStatusService';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';
import AppHeader from '../../components/AppHeader';

type SafetyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Safety'>;
type SafetyScreenRouteProp = RouteProp<RootStackParamList, 'Safety'>;

export default function SafetyScreen() {
    const navigation = useNavigation<SafetyScreenNavigationProp>();
    const route = useRoute<SafetyScreenRouteProp>();
    const { tripId } = route.params || {};
    const { t, isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    const [sending, setSending] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('permissionDenied') || 'Permission denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);
        })();
    }, []);

    const handleSOS = () => {
        Alert.alert(
            t('sendSosAlert') || "Send SOS Alert?",
            t('sosAlertDescription') || "This will instantly notify our Safety Team and share your live location and trip details.",
            [
                { text: t('cancel') || "Cancel", style: "cancel" },
                {
                    text: t('sendAlert') || "SEND ALERT",
                    style: "destructive",
                    onPress: confirmSOS
                }
            ]
        );
    };

    const confirmSOS = async () => {
        let currentLocation = location;
        if (!currentLocation) {
            Alert.alert(t('error') || "Error", t('detectingLocation') || "We cannot detect your location yet. Please wait a moment.");
            const loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);
            currentLocation = loc;
            if (!currentLocation) return;
        }

        setSending(true);

        try {
            // 1. Find Trip ID and Snapshot
            let activeTripId = tripId;
            let tripSnapshot: any = (route.params as any).trip;

            if (!activeTripId && tripStatusService.isMonitoring()) {
                activeTripId = tripStatusService.getCurrentTripId() || undefined;
            }

            // If we have tripId but no snapshot (e.g. from deep link or missing params), fetch it
            if (activeTripId && !tripSnapshot) {
                try {
                    const data = await apiRequest<{ trip: any }>(`/trips/${activeTripId}`);
                    tripSnapshot = data.trip;
                } catch {
                    // ignore
                }
            }
            // If completely missing trip info, try to fetch active trip
            else if (!activeTripId) {
                try {
                    const data = await apiRequest<{ trip: any }>('/trips/active');
                    activeTripId = data.trip?.id;
                    tripSnapshot = data.trip;
                } catch {
                    // ignore
                }
            }

            if (!activeTripId) {
                Alert.alert(t('noActiveTrip') || "No Active Trip", t('noActiveTripDesc') || "We couldn't find an active trip to attach this SOS alert.");
                return;
            }

            console.log("[SOS] Sending Alert. Trip:", activeTripId);

            // 3. Prepare Metadata Snapshot
            const metadata = {
                source: 'app_sos_button',
                timestamp: new Date().toISOString(),
                snapshot: {
                    trip: tripSnapshot,
                    location_text: tripSnapshot?.pickup_address || "Unknown Location",
                    device_info: "React Native App"
                }
            };

            await apiRequest('/sos/create', {
                method: 'POST',
                body: JSON.stringify({
                    trip_id: activeTripId,
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                    notes: "SOS from Customer App",
                    metadata
                })
            });

            Alert.alert(
                t('sosSent') || "SOS Alert Sent",
                t('sosSentDesc') || "Our team has been notified and is tracking your location. Stay calm.",
                [{ text: "OK" }]
            );

        } catch (error: any) {
            console.error("SOS Error:", error);
            Alert.alert(t('failed') || "Failed", t('sosFailed') || "Could not send alert. Please call police directly.");
        } finally {
            setSending(false);
        }
    };

    const handleCallPolice = () => {
        Linking.openURL('tel:122');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader title={t('safetyCenter') || 'Safety Center'} showBack={true} />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Hero Status */}
                <LinearGradient
                    colors={isDark ? ['#1e3a8a33', '#1e3a8a66'] : ['#EFF6FF', '#DBEAFE']}
                    style={[styles.statusCard, { borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}
                >
                    <ShieldAlert size={48} color={isDark ? colors.primary : "#3B82F6"} />
                    <Text style={[styles.statusTitle, { color: isDark ? colors.textPrimary : '#1E3A8A' }]}>{t('safetyToolkit') || 'Safety Toolkit'}</Text>
                    <Text style={[styles.statusDesc, { color: isDark ? colors.textSecondary : '#3B82F6' }]}>{t('safetyToolkitDesc') || 'Your safety is our top priority. Access these tools anytime during your trip.'}</Text>
                </LinearGradient>

                <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }]}>{t('emergencyAssistance') || 'Emergency Assistance'}</Text>

                {/* SOS Button */}
                <TouchableOpacity
                    style={[
                        styles.actionBtn,
                        {
                            borderColor: isDark ? colors.danger + '44' : '#FECACA',
                            backgroundColor: isDark ? colors.danger + '11' : '#FEF2F2',
                            flexDirection: isRTL ? 'row-reverse' : 'row'
                        }
                    ]}
                    onPress={handleSOS}
                    disabled={sending}
                >
                    <View style={[styles.iconCircle, { backgroundColor: isDark ? colors.danger + '22' : '#FEE2E2', marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }]}>
                        {sending ? <ActivityIndicator color={colors.danger} /> : <AlertTriangle size={24} color={colors.danger} />}
                    </View>
                    <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                        <Text style={[styles.btnTitle, { color: colors.danger }]}>{t('sosEmergency') || 'SOS Emergency Alert'}</Text>
                        <Text style={[styles.btnSub, { color: colors.textSecondary }]}>{t('sosEmergencySub') || 'Instantly notify support team'}</Text>
                    </View>
                    <ChevronRight size={20} color={isDark ? colors.danger + '88' : "#FCA5A5"} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.actionBtn,
                        {
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            flexDirection: isRTL ? 'row-reverse' : 'row'
                        }
                    ]}
                    onPress={handleCallPolice}
                >
                    <View style={[styles.iconCircle, { backgroundColor: colors.background, marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0 }]}>
                        <PhoneCall size={24} color={colors.textPrimary} />
                    </View>
                    <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                        <Text style={[styles.btnTitle, { color: colors.textPrimary }]}>{t('callPolice') || 'Call Police'}</Text>
                        <Text style={[styles.btnSub, { color: colors.textSecondary }]}>{t('callPoliceSub') || 'Direct line to 122'}</Text>
                    </View>
                    <ChevronRight size={20} color={colors.textMuted} style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    statusCard: { padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
    statusTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
    statusDesc: { textAlign: 'center', lineHeight: 20, opacity: 0.8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    btnTitle: { fontSize: 16, fontWeight: 'bold' },
    btnSub: { fontSize: 13 },
});
