import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useNotifications() {
    // Helper to check for unsupported Expo Go environment on Android (SDK 53+)
    const isUnsupportedExpoGoAndroid = () => {
        return Platform.OS === 'android' && Constants.appOwnership === 'expo';
    };

    useEffect(() => {
        if (Platform.OS === 'web' || isUnsupportedExpoGoAndroid()) return;

        let isMounted = true;

        const setupHandler = async () => {
            try {
                const Notifications = await import('expo-notifications');
                if (!isMounted) return;

                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowBanner: true,
                        shouldShowList: true,
                        shouldPlaySound: true,
                        shouldSetBadge: false,
                    }),
                });
            } catch (err) {
                console.warn('Notification handler setup error:', err);
            }
        };

        setupHandler();

        return () => {
            isMounted = false;
        };
    }, []);

    const sendNotification = async (title: string, body: string, data?: Record<string, any>) => {
        if (Platform.OS === 'web') return;

        if (isUnsupportedExpoGoAndroid()) {
            return;
        }

        try {
            const Notifications = await import('expo-notifications');
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data ?? {},
                },
                trigger: null,
            });
        } catch (err) {
            console.warn('Failed to send notification:', err);
        }
    };

    const sendScheduleNotification = async (deviceName: string, isOn: boolean) => {
        await sendNotification(
            'Schedule Triggered',
            `${deviceName} has been turned ${isOn ? 'ON' : 'OFF'} by schedule.`,
            { deviceName, isOn, type: 'schedule' },
        );
    };

    const requestPermissions = async () => {
        if (Platform.OS === 'web') return;

        if (isUnsupportedExpoGoAndroid()) {
            return;
        }

        try {
            const Notifications = await import('expo-notifications');

            // Setup channel for Android so notifications can heads-up / popup
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#8B5CF6',
                });
            }

            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                await Notifications.requestPermissionsAsync();
            }
        } catch (err) {
            console.warn('Notification permissions error:', err);
        }
    };

    return {
        sendNotification,
        sendScheduleNotification,
        requestPermissions,
    };
}
