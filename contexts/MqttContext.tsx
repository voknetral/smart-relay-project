import { APP_DEFAULTS } from '@/constants/Config';
import { Storage } from '@/utils/storage';
import mqtt from 'mqtt';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface MqttState {
    connected: boolean;
    error: string | null;
}

interface MqttContextValue extends MqttState {
    subscribe: (topic: string) => void;
    publish: (topic: string, message: string, options?: mqtt.IClientPublishOptions) => void;
    onMessage: (callback: (topic: string, message: Buffer) => void) => () => void;
    reconnect: (host: string, port: string, topic?: string) => void;
    mcuOnline: boolean;
    mqttTopic: string;
}

const MqttContext = createContext<MqttContextValue | undefined>(undefined);

export function MqttProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<MqttState>({
        connected: false,
        error: null,
    });

    const [remoteHost, setRemoteHost] = useState('');
    const [remotePort, setRemotePort] = useState('');
    const [mqttTopic, setMqttTopic] = useState(APP_DEFAULTS.mqttTopic);
    const [mcuOnline, setMcuOnline] = useState(false);
    const clientRef = useRef<mqtt.MqttClient | null>(null);
    const previousAvailabilityTopicRef = useRef(`${APP_DEFAULTS.mqttTopic}/availability`);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const clientIdRef = useRef(`smart-relay-${Math.random().toString(16).slice(2, 10)}`);
    const currentBrokerUrlRef = useRef<string | null>(null);
    const debugLog = (...args: any[]) => {
        if (__DEV__) {
            console.log(...args);
        }
    };

    const resolveBrokerUrl = useCallback((host: string, port: string) => {
        const normalizedHost = (host || APP_DEFAULTS.mqttHost).trim();
        let normalizedPort = (port || APP_DEFAULTS.mqttPort).trim();
        let protocol = 'wss';

        // HiveMQ public broker for app-side WebSocket access should use 8884 by default.
        if (normalizedHost === 'broker.hivemq.com' && normalizedPort === '1883') {
            normalizedPort = '8884';
        }

        if (normalizedPort === '8000' || normalizedPort === '8083') {
            protocol = 'ws';
        }

        return `${protocol}://${normalizedHost}:${normalizedPort}/mqtt`;
    }, []);

    // Initial load from storage
    useEffect(() => {
        const load = async () => {
            const config = await Storage.loadConfig();
            if (config) {
                setRemoteHost(config.mqttHost || APP_DEFAULTS.mqttHost);
                setRemotePort(config.mqttPort || APP_DEFAULTS.mqttPort);
                setMqttTopic(config.mqttTopic || APP_DEFAULTS.mqttTopic);
            } else {
                setRemoteHost(APP_DEFAULTS.mqttHost);
                setRemotePort(APP_DEFAULTS.mqttPort);
            }
        };
        load();
    }, []);

    const doConnect = useCallback((host: string, port: string, topic: string) => {
        if (!host || !port) return;

        const brokerUrl = resolveBrokerUrl(host, port);

        if (clientRef.current && currentBrokerUrlRef.current === brokerUrl && clientRef.current.connected) {
            debugLog('MQTT already connected:', brokerUrl);
            return;
        }

        if (clientRef.current) {
            debugLog('Ending previous MQTT connection...');
            clientRef.current.end(true);
            clientRef.current = null;
        }

        debugLog('Connecting Global MQTT:', brokerUrl);

        try {
            const client = mqtt.connect(brokerUrl, {
                clientId: clientIdRef.current,
                clean: false,
                connectTimeout: 30000,
                reconnectPeriod: 2500,
                keepalive: 45,
                resubscribe: true,
                queueQoSZero: true,
                reschedulePings: true,
                protocolVersion: 4,
            });

            client.on('connect', () => {
                debugLog('Global MQTT Connected');
                currentBrokerUrlRef.current = brokerUrl;
                setState({ connected: true, error: null });
                // Subscribe to availability once connected
                const availabilityTopic = `${topic}/availability`;
                previousAvailabilityTopicRef.current = availabilityTopic;
                client.subscribe(availabilityTopic);
            });

            client.on('message', (topic, payload) => {
                if (topic.endsWith('/availability')) {
                    setMcuOnline(payload.toString() === 'online');
                }
            });

            client.on('error', (err) => {
                setState({ connected: false, error: err.message });
            });

            client.on('offline', () => {
                setState((prev) => ({ ...prev, connected: false }));
            });

            client.on('reconnect', () => {
                setState((prev) => ({ ...prev, connected: false }));
            });

            client.on('close', () => {
                setState((prev) => ({ ...prev, connected: false }));
                setMcuOnline(false); // If MQTT is closed, assume MCU is offline
            });

            clientRef.current = client;
        } catch (err: any) {
            setState({ connected: false, error: err.message });
        }
    }, [resolveBrokerUrl]);

    useEffect(() => {
        if (remoteHost && remotePort) {
            doConnect(remoteHost, remotePort, mqttTopic);
        }
        return () => {
            if (clientRef.current) {
                clientRef.current.end(true);
            }
        };
    }, [remoteHost, remotePort, mqttTopic, doConnect]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;

            if (
                previousState.match(/inactive|background/) &&
                nextState === 'active' &&
                !clientRef.current?.connected &&
                remoteHost &&
                remotePort
            ) {
                doConnect(remoteHost, remotePort, mqttTopic);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [doConnect, mqttTopic, remoteHost, remotePort]);

    const subscribe = useCallback((topic: string) => {
        if (clientRef.current && state.connected) {
            clientRef.current.subscribe(topic);
        }
    }, [state.connected]);

    const publish = useCallback((topic: string, message: string, options?: mqtt.IClientPublishOptions) => {
        if (clientRef.current && state.connected) {
            clientRef.current.publish(topic, message, options || { qos: 0, retain: false });
        }
    }, [state.connected]);

    const onMessage = useCallback((callback: (topic: string, message: Buffer) => void) => {
        const client = clientRef.current;
        if (client) {
            const listener = (topic: string, m: Buffer) => callback(topic, m);
            client.on('message', listener);
            return () => {
                client.removeListener('message', listener);
            };
        }
        return () => { };
    }, []);

    const reconnect = useCallback((host: string, port: string, topic?: string) => {
        const normalizedHost = host || APP_DEFAULTS.mqttHost;
        const normalizedPort = port || APP_DEFAULTS.mqttPort;
        const normalizedTopic = topic || mqttTopic || APP_DEFAULTS.mqttTopic;

        const hostChanged = normalizedHost !== remoteHost;
        const portChanged = normalizedPort !== remotePort;
        const topicChanged = normalizedTopic !== mqttTopic;

        if (topicChanged) {
            const nextAvailabilityTopic = `${normalizedTopic}/availability`;
            const previousAvailabilityTopic = previousAvailabilityTopicRef.current;

            setMqttTopic(normalizedTopic);

            if (clientRef.current && state.connected) {
                if (previousAvailabilityTopic !== nextAvailabilityTopic) {
                    clientRef.current.unsubscribe(previousAvailabilityTopic);
                }
                clientRef.current.subscribe(nextAvailabilityTopic);
                previousAvailabilityTopicRef.current = nextAvailabilityTopic;
            }
        }

        if (hostChanged) setRemoteHost(normalizedHost);
        if (portChanged) setRemotePort(normalizedPort);
    }, [mqttTopic, remoteHost, remotePort, state.connected]);

    return (
        <MqttContext.Provider value={{ ...state, subscribe, publish, onMessage, reconnect, mcuOnline, mqttTopic }}>
            {children}
        </MqttContext.Provider>
    );
}

export function useMqttContext() {
    const context = useContext(MqttContext);
    if (!context) {
        throw new Error('useMqttContext must be used within a MqttProvider');
    }
    return context;
}
