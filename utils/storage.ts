import { APP_DEFAULTS } from '@/constants/Config';
import { AppLanguage } from '@/constants/translations';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// @ts-ignore
const CONFIG_FILE = (FileSystem.documentDirectory || '') + 'app_config.json';
const WEB_STORAGE_KEY = 'anomali_app_config';

export interface AppConfig {
    username: string;
    city?: string;
    language?: AppLanguage;
    isSetupComplete: boolean;
    mqttTopic?: string;
    mqttHost?: string;
    mqttPort?: string;
    deviceSettings?: Record<string, { name: string; iconType: string; customIconUri?: string }>;
    customDevices?: { id: string; name: string; iconType: string; customIconUri?: string; accentColor: string; isHardwareVerified?: boolean }[];
    scheduleTemplates?: { id: string; name: string; startTime: string; endTime: string }[];
}

export const DEFAULT_CONFIG: AppConfig = {
    ...APP_DEFAULTS,
    isSetupComplete: false,
    deviceSettings: {},
    scheduleTemplates: [],
};

export const Storage = {
    async saveConfig(config: AppConfig): Promise<void> {
        if (Platform.OS === 'web') {
            try {
                localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(config));
            } catch (error) {
                console.error('Error saving config to localStorage:', error);
            }
            return;
        }

        try {
            const json = JSON.stringify(config);
            await FileSystem.writeAsStringAsync(CONFIG_FILE, json);
        } catch (error) {
            console.error('Error saving config:', error);
        }
    },

    async loadConfig(): Promise<AppConfig | null> {
        if (Platform.OS === 'web') {
            try {
                const json = localStorage.getItem(WEB_STORAGE_KEY);
                const saved = json ? JSON.parse(json) : {};
                return { ...DEFAULT_CONFIG, ...saved };
            } catch (error) {
                console.error('Error loading config from localStorage:', error);
                return null;
            }
        }

        try {
            const info = await FileSystem.getInfoAsync(CONFIG_FILE);
            if (info.exists) {
                const json = await FileSystem.readAsStringAsync(CONFIG_FILE);
                const saved = JSON.parse(json);
                return { ...DEFAULT_CONFIG, ...saved };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        return DEFAULT_CONFIG;
    },

    async isSetupComplete(): Promise<boolean> {
        const config = await this.loadConfig();
        return !!config?.isSetupComplete;
    },

    async clearConfig(): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.removeItem(WEB_STORAGE_KEY);
            return;
        }

        try {
            await FileSystem.deleteAsync(CONFIG_FILE, { idempotent: true });
        } catch (error) {
            console.error('Error clearing config:', error);
        }
    },

    async saveDeviceSettings(deviceId: string, settings: { name: string; iconType: string; customIconUri?: string }): Promise<void> {
        const config = await this.loadConfig();
        if (!config) return;

        const updatedConfig = {
            ...config,
            deviceSettings: {
                ...(config.deviceSettings || {}),
                [deviceId]: settings,
            },
        };
        await this.saveConfig(updatedConfig);
    },

    async saveCustomDevices(devices: { id: string; name: string; iconType: string; customIconUri?: string; accentColor: string; isHardwareVerified?: boolean }[]): Promise<void> {
        const config = await this.loadConfig();
        if (!config) return;

        const updatedConfig = {
            ...config,
            customDevices: devices,
        };
        await this.saveConfig(updatedConfig);
    },

    async saveScheduleTemplates(templates: { id: string; name: string; startTime: string; endTime: string }[]): Promise<void> {
        const config = await this.loadConfig();
        if (!config) return;

        const updatedConfig = {
            ...config,
            scheduleTemplates: templates,
        };
        await this.saveConfig(updatedConfig);
    },

    async loadScheduleTemplates(): Promise<{ id: string; name: string; startTime: string; endTime: string }[]> {
        const config = await this.loadConfig();
        return config?.scheduleTemplates || [];
    }
};


