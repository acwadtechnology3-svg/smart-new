import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../theme/useTheme';

interface MessageBubbleProps {
    role: 'bot' | 'user';
    text: string;
    timestamp: Date;
}

export default function MessageBubble({ role, text, timestamp }: MessageBubbleProps) {
    const { isRTL } = useLanguage();
    const { colors, isDark } = useTheme();
    const isBot = role === 'bot';

    // Check if this is a trip summary message
    const isTripSummary = text.includes('━━━━━━━━━━━━━━━━━━━━━━') || text.includes('ملخص رحلتك');

    // Split text by line breaks for better rendering
    const lines = text.split('\n');

    if (isTripSummary) {
        console.log('💬 [MessageBubble] Rendering trip summary with', lines.length, 'lines');
        console.log('💬 [MessageBubble] First 3 lines:', lines.slice(0, 3));
    }

    return (
        <View style={[
            styles.container,
            { alignItems: isBot ? (isRTL ? 'flex-end' : 'flex-start') : (isRTL ? 'flex-start' : 'flex-end') }
        ]}>
            <View style={[
                styles.bubble,
                isBot ? styles.botBubble : styles.userBubble,
                isTripSummary && styles.tripSummaryBubble,
                isBot && { backgroundColor: isDark ? colors.surface2 : '#EFF6FF' },
                !isBot && { backgroundColor: colors.primary },
                isTripSummary && {
                    backgroundColor: isDark ? colors.surface2 : '#F0F9FF',
                    borderColor: isDark ? colors.border : '#BFDBFE',
                },
                { alignSelf: isBot ? (isRTL ? 'flex-end' : 'flex-start') : (isRTL ? 'flex-start' : 'flex-end') }
            ]}>
                {lines.map((line, index) => {
                    // Check if line is a separator
                    const isSeparator = line.includes('━━━━━━━━━━━━━━━━━━━━━━');

                    // Check if line contains key info (emoji indicators)
                    const isKeyInfo = /^(📍|🚗|📏|⏱️|💰)/.test(line.trim());

                    // Check if line is a header
                    const isHeader = line.includes('ملخص رحلتك') || line.includes('✅ تم!');

                    if (isSeparator) {
                        return (
                            <View key={index} style={styles.separator} />
                        );
                    }

                    if (line.trim() === '') {
                        return <View key={index} style={{ height: 4 }} />;
                    }

                    return (
                        <Text
                            key={index}
                            style={[
                                styles.text,
                                isBot ? styles.botText : styles.userText,
                                isHeader && styles.headerText,
                                isKeyInfo && styles.keyInfoText,
                                isBot && { color: colors.textPrimary },
                                !isBot && { color: colors.textOnPrimary },
                                isHeader && { color: colors.textPrimary },
                                isKeyInfo && { color: colors.textPrimary },
                                { textAlign: isRTL ? 'right' : 'left' }
                            ]}
                        >
                            {line}
                        </Text>
                    );
                })}

                <Text
                    style={[
                        styles.timestamp,
                        isBot ? styles.botTimestamp : styles.userTimestamp,
                        isBot ? { color: colors.textMuted } : { color: colors.textOnPrimary, opacity: 0.85 },
                    ]}
                >
                    {timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    bubble: {
        maxWidth: '85%',
        padding: 14,
        borderRadius: 18,
    },
    botBubble: {
        backgroundColor: '#EFF6FF',
        borderBottomLeftRadius: 4,
    },
    userBubble: {
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
    },
    tripSummaryBubble: {
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        maxWidth: '92%',
        padding: 16,
    },
    text: {
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 2,
    },
    botText: {
        color: '#1F2937',
    },
    userText: {
        color: '#FFFFFF',
    },
    headerText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
        marginTop: 4,
    },
    keyInfoText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: 26,
        marginVertical: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#CBD5E1',
        marginVertical: 8,
        opacity: 0.5,
    },
    timestamp: {
        fontSize: 11,
        marginTop: 8,
    },
    botTimestamp: {
        color: '#6B7280',
    },
    userTimestamp: {
        color: '#E0E7FF',
    },
});
