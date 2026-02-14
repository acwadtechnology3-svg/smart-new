import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../theme/useTheme';

interface AppHeaderProps {
    title: string;
    showBack?: boolean;
    onBack?: () => void;
    rightElement?: React.ReactNode;
}

export default function AppHeader({ title, showBack = true, onBack, rightElement }: AppHeaderProps) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigation.goBack();
        }
    };

    return (
        <View style={[
            styles.container,
            {
                paddingTop: insets.top,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                shadowColor: colors.shadow || '#000'
            }
        ]}>
            <View style={styles.sideBlock}>
                {showBack && (
                    <TouchableOpacity onPress={handleBack} style={[styles.backButton, { backgroundColor: isDark ? colors.background : '#E5E7EB', borderColor: colors.border }]}>
                        <ArrowLeft
                            size={28}
                            color={colors.textPrimary}
                            strokeWidth={3.5}
                            style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
                        />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.centerBlock}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
            </View>

            <View style={[styles.sideBlock, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
                {rightElement}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        ...Platform.select({
            ios: {
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    sideBlock: {
        width: 48,
        justifyContent: 'center',
    },
    centerBlock: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
});
