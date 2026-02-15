import React, { createContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Appearance, ViewStyle } from 'react-native';
import { storage } from '../utils/storage';
import { lightColors, darkColors, ThemeColors } from './palettes';
import * as tokens from './tokens';

type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    resolvedScheme: 'light' | 'dark';
    isDark: boolean;
    colors: ThemeColors;
    tokens: typeof tokens;
    spacing: typeof tokens.spacing;
    radius: typeof tokens.radius;
    shadow: (level: keyof typeof tokens.shadows) => ViewStyle;
    isReady: boolean;
}

const shadowFn = (level: keyof typeof tokens.shadows) => tokens.shadows[level] || tokens.shadows.none;

export const ThemeContext = createContext<ThemeContextType>({
    mode: 'system',
    setMode: () => { },
    resolvedScheme: 'light',
    isDark: false,
    colors: lightColors,
    tokens,
    spacing: tokens.spacing,
    radius: tokens.radius,
    shadow: shadowFn,
    isReady: false,
});

const THEME_STORAGE_KEY = 'app_theme_mode';

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
        Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
    );
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        // Load stored theme preference
        const loadTheme = async () => {
            const storedMode = await storage.getItem<ThemeMode>(THEME_STORAGE_KEY);
            if (storedMode) {
                setModeState(storedMode);
            }
            setIsReady(true);
        };
        loadTheme();
    }, []);

    const setMode = useCallback(async (newMode: ThemeMode) => {
        setModeState(newMode);
        await storage.setItem(THEME_STORAGE_KEY, newMode);
    }, []);

    const resolvedScheme = mode === 'system'
        ? systemScheme
        : mode;

    const isDark = resolvedScheme === 'dark';
    const colors = isDark ? darkColors : lightColors;

    // Memoize the context value so consumers don't re-render
    // unless mode, resolvedScheme, or isReady actually changes.
    // Previously, `value` was a new object on every render,
    // and `shadow` was a new function reference every time —
    // causing the entire app tree to re-render on any parent change.
    const value = useMemo(() => ({
        mode,
        setMode,
        resolvedScheme,
        isDark,
        colors,
        tokens,
        spacing: tokens.spacing,
        radius: tokens.radius,
        shadow: shadowFn,
        isReady,
    }), [mode, setMode, resolvedScheme, isDark, isReady]);

    if (!isReady) {
        return null; // or a splash screen component
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
