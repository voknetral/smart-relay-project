import { DEFAULT_CONFIG } from '@/utils/storage';
import mqtt from 'mqtt';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface MqttState {
    connected: boolean;
    error: string | null;
}

export function useMqtt(
    host: string = DEFAULT_CONFIG.mqttHost!,
    port: string = DEFAULT_CONFIG.mqttPort!,
    clientIdPrefix: string = 'anomali-client'
) {
    const [state, setState] = useState<MqttState>({
        connected: false,
        error: null,
    });

    const clientRef = useRef<mqtt.MqttClient | null>(null);

    useEffect(() => {
        const actualHost = host || DEFAULT_CONFIG.mqttHost;
        const actualPort = port || DEFAULT_CONFIG.mqttPort;

        if (!actualHost || !actualPort) return;

        // Basic port validation to prevent WebSocket constructor crash
        const portNum = parseInt(actualPort, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            console.warn('Invalid MQTT Port:', actualPort);
            setState({ connected: false, error: 'Invalid Port' });
            return;
        }

        const brokerUrl = `wss://${actualHost}:${actualPort}/mqtt`;
        console.log('Connecting to MQTT:', brokerUrl);

        const clientId = `${clientIdPrefix}-${Math.random().toString(16).substring(2, 10)}`;

        try {
            const client = mqtt.connect(brokerUrl, {
                clientId,
                clean: true, // MUST be true for randomly generated Client IDs on public brokers
                connectTimeout: 15000, // Longer timeout for spotty networks
                reconnectPeriod: 2000, // Wait 2s before reconnecting
                keepalive: 60, // Ping broker every 60s
                resubscribe: true, // Auto-resubscribe after reconnect
            });

            client.on('connect', () => {
                console.log('MQTT Connected');
                setState({ connected: true, error: null });
            });

            client.on('reconnect', () => {
                console.log('MQTT Reconnecting...');
                setState((prev) => ({ ...prev, connected: false }));
            });

            client.on('error', (err) => {
                console.error('MQTT Error:', err);
                setState({ connected: false, error: err.message });
            });

            client.on('offline', () => {
                console.log('MQTT Offline');
                setState((prev) => ({ ...prev, connected: false }));
            });

            client.on('close', () => {
                console.log('MQTT Closed');
                setState((prev) => ({ ...prev, connected: false }));
            });

            clientRef.current = client;
        } catch (err: any) {
            console.error('Failed to initialize MQTT client:', err);
            setState({ connected: false, error: err.message });
        }

        return () => {
            if (clientRef.current) {
                clientRef.current.end();
            }
        };
    }, [host, port, clientIdPrefix]);

    const subscribe = useCallback((topic: string) => {
        if (clientRef.current && state.connected) {
            clientRef.current.subscribe(topic, (err) => {
                if (err) {
                    console.error(`Subscribe error to ${topic}:`, err);
                } else {
                    console.log(`Subscribed to ${topic}`);
                }
            });
        }
    }, [state.connected]);

    const publish = useCallback((topic: string, message: string, options?: mqtt.IClientPublishOptions) => {
        if (clientRef.current && state.connected) {
            clientRef.current.publish(topic, message, options || { qos: 0, retain: false }, (err) => {
                if (err) {
                    console.error(`Publish error to ${topic}:`, err);
                }
            });
        }
    }, [state.connected]);

    const onMessage = useCallback((callback: (topic: string, message: Buffer) => void) => {
        if (clientRef.current) {
            const listener = (topic: string, message: Buffer) => {
                callback(topic, message);
            };
            clientRef.current.on('message', listener);
            return () => {
                if (clientRef.current) {
                    clientRef.current.removeListener('message', listener);
                }
            };
        }
        return () => { };
    }, []);

    return {
        ...state,
        subscribe,
        publish,
        onMessage,
    };
}
