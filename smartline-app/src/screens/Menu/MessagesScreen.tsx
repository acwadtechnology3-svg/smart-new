import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Platform } from 'react-native';
import { ArrowLeft, Bell, Car } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/useTheme';

const MESSAGES = [
    { id: '1', title: 'Driver Arriving', desc: 'Ahmed is 2 mins away!', time: 'Now', icon: 'car', unread: true },
    { id: '2', title: '50% Off Promo', desc: 'Use code SAVE50 for your next ride.', time: '2h ago', icon: 'promo', unread: false },
    { id: '3', title: 'Trip Completed', desc: 'You paid 45 EGP for your ride to Work.', time: 'Yesterday', icon: 'receipt', unread: false },
];

export default function MessagesScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Messages</Text>
            </View>

            <FlatList
                data={MESSAGES}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity style={[
                        styles.card,
                        { backgroundColor: colors.surface, shadowColor: colors.shadow },
                        item.unread && { borderLeftWidth: 4, borderLeftColor: colors.primary }
                    ]}>
                        <View style={[styles.iconBox, item.unread ? { backgroundColor: colors.surfaceHighlight } : { backgroundColor: colors.background }]}>
                            {item.icon === 'car' ? <Car size={24} color={item.unread ? colors.primary : colors.textMuted} /> : <Bell size={24} color={item.unread ? colors.primary : colors.textMuted} />}
                        </View>
                        <View style={styles.textContainer}>
                            <View style={styles.topRow}>
                                <Text style={[styles.title, { color: colors.textPrimary }, item.unread && { fontWeight: 'bold' }]}>{item.title}</Text>
                                <Text style={[styles.time, { color: colors.textMuted }]}>{item.time}</Text>
                            </View>
                            <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>{item.desc}</Text>
                        </View>
                        {item.unread && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10
    },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    card: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
    iconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    textContainer: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    title: { fontSize: 16, fontWeight: '600' },
    time: { fontSize: 12 },
    desc: { fontSize: 14 },
    dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
});
