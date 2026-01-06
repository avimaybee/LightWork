import { useState, useEffect } from 'react';

export interface AppSettings {
    // Appearance
    theme: 'light' | 'dark' | 'system';
    density: 'comfortable' | 'compact';
    reduceMotion: boolean;

    // Workflow & Intelligence
    defaultModel: 'fast' | 'pro';
    autoDraft: boolean;
    smartRename: boolean;

    // Data & Export
    defaultExportFormat: 'png' | 'jpg' | 'webp';
    exportQuality: number; // 0-100
    filenamePattern: 'original' | 'smart' | 'date_original';

    // System
    notifications: boolean;

    // Beta
    experimentalFeatures: boolean;
    debugMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'light',
    density: 'comfortable',
    reduceMotion: false,
    defaultModel: 'fast',
    autoDraft: false,
    smartRename: false,
    defaultExportFormat: 'png',
    exportQuality: 90,
    filenamePattern: 'smart',
    notifications: true,
    experimentalFeatures: false,
    debugMode: false,
};

const SETTINGS_KEY = 'lightwork_app_settings_v1';

export const useSettings = () => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
        return DEFAULT_SETTINGS;
    });

    const updateSettings = (updates: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
            } catch (e) {
                console.error('Failed to save settings', e);
            }
            return next;
        });
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        localStorage.removeItem(SETTINGS_KEY);
    };

    // Effect to apply theme immediately (if we had efficient dark mode support ready)
    useEffect(() => {
        const root = window.document.documentElement;
        if (settings.theme === 'dark') {
            root.classList.add('dark');
        } else if (settings.theme === 'light') {
            root.classList.remove('dark');
        }
        // 'system' logic would go here
    }, [settings.theme]);

    return {
        settings,
        updateSettings,
        resetSettings
    };
};
