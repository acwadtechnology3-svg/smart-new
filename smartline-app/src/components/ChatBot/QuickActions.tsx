import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { QuickAction } from '../../services/chatBotService';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

interface QuickActionsProps {
    actions: QuickAction[];
    onActionPress: (action: QuickAction) => void;
}

export default function QuickActions({ actions, onActionPress }: QuickActionsProps) {
    const { isRTL } = useLanguage();
    const { colors, isDark } = useTheme();

    if (!actions || actions.length === 0) return null;

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
                {actions.map((action) => (
                    <TouchableOpacity
                        key={action.id}
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor: isDark ? colors.surface2 : colors.surface,
                                borderColor: colors.primary,
                                shadowColor: colors.shadow,
                            },
                        ]}
                        onPress={() => onActionPress(action)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.actionText, { color: colors.primary }]}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    actionButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    actionText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
});
