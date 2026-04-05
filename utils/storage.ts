import type { NotificationItem } from "@/components/smart-home/NotificationModal";
import type { Schedule } from "@/components/smart-home/ScheduleModal";
import { APP_DEFAULTS } from "@/constants/Config";
import { AppLanguage } from "@/constants/translations";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

// @ts-ignore
const CONFIG_FILE = (FileSystem.documentDirectory || "") + "app_config.json";
const LOGS_FILE = (FileSystem.documentDirectory || "") + "app_logs.json";
const WEB_STORAGE_KEY = "voknetral_app_config";
const WEB_LOGS_KEY = "voknetral_app_logs";
const LEGACY_WEB_STORAGE_KEY = "anomali_app_config";
let configMutationQueue: Promise<unknown> = Promise.resolve();

export interface StoredDevice {
  id: string;
  name: string;
  iconType: string;
  customIconUri?: string;
  accentColor: string;
  isHardwareVerified?: boolean;
  isOn?: boolean;
  mode?: "auto" | "manual";
  schedules?: Schedule[];
}

export interface StoredNotification extends Omit<
  NotificationItem,
  "timestamp"
> {
  timestamp: string;
}

export interface ApplicationLog {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: "info" | "success" | "warning" | "error";
}

export interface StoredApplicationLog extends Omit<
  ApplicationLog,
  "timestamp"
> {
  timestamp: string;
}

export interface AppConfig {
  username: string;
  city?: string;
  language?: AppLanguage;
  isSetupComplete: boolean;
  mqttTopic?: string;
  mqttHost?: string;
  mqttPort?: string;
  captureConsoleLogs?: boolean;
  deviceSettings?: Record<
    string,
    { name: string; iconType: string; customIconUri?: string }
  >;
  customDevices?: StoredDevice[];
  notifications?: StoredNotification[];
}

export const DEFAULT_CONFIG: AppConfig = {
  ...APP_DEFAULTS,
  isSetupComplete: false,
  captureConsoleLogs: false,
  deviceSettings: {},
  notifications: [],
};

async function readStoredConfig(): Promise<AppConfig | null> {
  if (Platform.OS === "web") {
    try {
      const json = localStorage.getItem(WEB_STORAGE_KEY);
      const legacyJson = json
        ? null
        : localStorage.getItem(LEGACY_WEB_STORAGE_KEY);
      const rawConfig = json ?? legacyJson;
      const saved = rawConfig ? JSON.parse(rawConfig) : {};

      if (!json && legacyJson) {
        localStorage.setItem(WEB_STORAGE_KEY, legacyJson);
        localStorage.removeItem(LEGACY_WEB_STORAGE_KEY);
      }

      return { ...DEFAULT_CONFIG, ...saved };
    } catch (error) {
      console.error("Error loading config from localStorage:", error);
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
    console.error("Error loading config:", error);
  }

  return DEFAULT_CONFIG;
}

async function writeStoredConfig(config: AppConfig): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(config));
      localStorage.removeItem(LEGACY_WEB_STORAGE_KEY);
    } catch (error) {
      console.error("Error saving config to localStorage:", error);
    }
    return;
  }

  try {
    const json = JSON.stringify(config);
    await FileSystem.writeAsStringAsync(CONFIG_FILE, json);
  } catch (error) {
    console.error("Error saving config:", error);
  }
}

function enqueueConfigMutation<T>(operation: () => Promise<T>): Promise<T> {
  const nextOperation = configMutationQueue.then(operation, operation);
  configMutationQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function updateStoredConfig(
  updater: (config: AppConfig) => AppConfig | Promise<AppConfig>,
): Promise<void> {
  await enqueueConfigMutation(async () => {
    const currentConfig = (await readStoredConfig()) ?? DEFAULT_CONFIG;
    const nextConfig = await updater(currentConfig);
    await writeStoredConfig(nextConfig);
  });
}

export const Storage = {
  async saveConfig(config: AppConfig): Promise<void> {
    await updateStoredConfig((currentConfig) => ({
      ...currentConfig,
      ...config,
    }));
  },

  async loadConfig(): Promise<AppConfig | null> {
    await configMutationQueue;
    return readStoredConfig();
  },

  async isSetupComplete(): Promise<boolean> {
    const config = await this.loadConfig();
    return !!config?.isSetupComplete;
  },

  async clearConfig(): Promise<void> {
    await enqueueConfigMutation(async () => {
      if (Platform.OS === "web") {
        localStorage.removeItem(WEB_STORAGE_KEY);
        localStorage.removeItem(LEGACY_WEB_STORAGE_KEY);
        return;
      }

      try {
        await FileSystem.deleteAsync(CONFIG_FILE, { idempotent: true });
      } catch (error) {
        console.error("Error clearing config:", error);
      }
    });
  },

  async saveDeviceSettings(
    deviceId: string,
    settings: { name: string; iconType: string; customIconUri?: string },
  ): Promise<void> {
    await updateStoredConfig((config) => ({
      ...config,
      deviceSettings: {
        ...(config.deviceSettings || {}),
        [deviceId]: settings,
      },
    }));
  },

  async saveCustomDevices(devices: StoredDevice[]): Promise<void> {
    await updateStoredConfig((config) => ({
      ...config,
      customDevices: devices,
    }));
  },

  async saveNotifications(notifications: NotificationItem[]): Promise<void> {
    const serialized: StoredNotification[] = notifications.map(
      (notification) => ({
        ...notification,
        timestamp: notification.timestamp.toISOString(),
      }),
    );

    await updateStoredConfig((config) => ({
      ...config,
      notifications: serialized,
    }));
  },

  async loadNotifications(): Promise<NotificationItem[]> {
    const config = await this.loadConfig();
    return (config?.notifications || []).map((notification) => ({
      ...notification,
      timestamp: new Date(notification.timestamp),
    }));
  },

  async saveApplicationLogs(logs: ApplicationLog[]): Promise<void> {
    const serialized: StoredApplicationLog[] = logs.map((log) => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    }));

    if (Platform.OS === "web") {
      try {
        localStorage.setItem(WEB_LOGS_KEY, JSON.stringify(serialized));
      } catch (error) {
        console.error("Error saving logs to localStorage:", error);
      }
      return;
    }

    try {
      const json = JSON.stringify(serialized);
      await FileSystem.writeAsStringAsync(LOGS_FILE, json);
    } catch (error) {
      console.error("Error saving logs:", error);
    }
  },

  async loadApplicationLogs(): Promise<ApplicationLog[]> {
    if (Platform.OS === "web") {
      try {
        const json = localStorage.getItem(WEB_LOGS_KEY);
        const logs: StoredApplicationLog[] = json ? JSON.parse(json) : [];
        return logs.map((log) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
      } catch (error) {
        console.error("Error loading logs from localStorage:", error);
        return [];
      }
    }

    try {
      const info = await FileSystem.getInfoAsync(LOGS_FILE);
      if (info.exists) {
        const json = await FileSystem.readAsStringAsync(LOGS_FILE);
        const logs: StoredApplicationLog[] = JSON.parse(json);
        return logs.map((log) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
      }
    } catch (error) {
      console.error("Error loading logs:", error);
    }

    return [];
  },
};
