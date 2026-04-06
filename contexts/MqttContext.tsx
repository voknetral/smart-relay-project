import { APP_DEFAULTS } from "@/constants/Config";
import { Storage } from "@/utils/storage";
import mqtt from "mqtt";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

interface MqttState {
  connected: boolean;
  error: string | null;
}

interface MqttContextValue extends MqttState {
  subscribe: (topic: string) => void;
  publish: (
    topic: string,
    message: string,
    options?: mqtt.IClientPublishOptions,
  ) => void;
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

  const [remoteHost, setRemoteHost] = useState("");
  const [remotePort, setRemotePort] = useState("");
  const [mqttTopic, setMqttTopic] = useState(APP_DEFAULTS.mqttTopic);
  const [mcuOnline, setMcuOnline] = useState(false);
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const previousAvailabilityTopicRef = useRef(
    `${APP_DEFAULTS.mqttTopic}/availability`,
  );
  const mqttTopicRef = useRef(APP_DEFAULTS.mqttTopic);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const clientIdRef = useRef(
    `smart-relay-${Math.random().toString(16).slice(2, 10)}`,
  );
  const currentBrokerUrlRef = useRef<string | null>(null);
  const subscribedTopicsRef = useRef<Set<string>>(new Set());
  const lastHeartbeatRef = useRef<number>(0);
  const HEARTBEAT_TIMEOUT_MS = 35000; // 35 seconds - more responsive
  const reconnectAttemptsRef = useRef<number>(0);
  const connectionTimeRef = useRef<number>(0);
  const lastHeartbeatTimestampRef = useRef<number>(0); // Unix timestamp dari MCU
  const debugLog = (...args: any[]) => {
    if (__DEV__) {
      console.log("[MQTT Debug]", ...args);
    }
  };
  const updateMcuOnline = useCallback((isOnline: boolean) => {
    setMcuOnline(isOnline);
  }, []);

  const resetMcuHeartbeatTracking = useCallback(() => {
    lastHeartbeatRef.current = 0;
    lastHeartbeatTimestampRef.current = 0;
  }, []);

  const isBaseMcuTopic = useCallback((topic: string, suffix: string) => {
    return topic === `${mqttTopicRef.current}/${suffix}`;
  }, []);

  const isFreshMcuTimestamp = useCallback((timestampMs: number) => {
    if (!timestampMs) {
      return false;
    }

    const now = Date.now();
    const maxFutureSkewMs = 5 * 60 * 1000;
    const maxPastAgeMs = HEARTBEAT_TIMEOUT_MS * 2;
    const minimumReasonableTimestampMs = Date.UTC(2024, 0, 1);

    return (
      timestampMs >= minimumReasonableTimestampMs &&
      timestampMs <= now + maxFutureSkewMs &&
      now - timestampMs <= maxPastAgeMs
    );
  }, []);

  const resolveBrokerUrl = useCallback((host: string, port: string) => {
    const normalizedHost = (host || APP_DEFAULTS.mqttHost).trim();
    let normalizedPort = (port || APP_DEFAULTS.mqttPort).trim();
    let protocol = "wss";

    // HiveMQ public broker for app-side WebSocket access should use 8884 by default.
    if (normalizedHost === "broker.hivemq.com" && normalizedPort === "1883") {
      normalizedPort = "8884";
    }

    if (normalizedPort === "8000" || normalizedPort === "8083") {
      protocol = "ws";
    }

    return `${protocol}://${normalizedHost}:${normalizedPort}/mqtt`;
  }, []);

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptsRef.current;
    if (attempt === 0) return 500; // First attempt: 500ms
    if (attempt === 1) return 1000; // 2nd: 1s
    if (attempt === 2) return 2000; // 3rd: 2s
    if (attempt === 3) return 5000; // 4th: 5s
    return 10000; // 5th+: 10s
  }, []);

  const updateAvailabilitySubscription = useCallback((topic: string) => {
    const client = clientRef.current;
    const nextAvailabilityTopic = `${topic}/availability`;
    const nextHeartbeatTopic = `${topic}/heartbeat`;
    const nextStatusTopic = `${topic}/status`;
    const previousAvailabilityTopic = previousAvailabilityTopicRef.current;
    const previousTopicBase = previousAvailabilityTopic.replace(
      /\/availability$/,
      "",
    );
    const previousHeartbeatTopic = `${previousTopicBase}/heartbeat`;
    const previousStatusTopic = `${previousTopicBase}/status`;

    if (!client || !client.connected) {
      previousAvailabilityTopicRef.current = nextAvailabilityTopic;
      // Don't set mcuOnline here - let timeout detection handle it
      return;
    }

    if (previousAvailabilityTopic !== nextAvailabilityTopic) {
      client.unsubscribe(previousAvailabilityTopic);
      client.unsubscribe(previousHeartbeatTopic);
      client.unsubscribe(previousStatusTopic);
    }

    // Subscribe ke availability, heartbeat, dan status topics (QoS 1)
    client.subscribe(nextAvailabilityTopic, { qos: 1 });
    client.subscribe(nextHeartbeatTopic, { qos: 1 });
    client.subscribe(nextStatusTopic, { qos: 1 });

    debugLog("Subscribed to MCU status topics:", {
      availability: nextAvailabilityTopic,
      heartbeat: nextHeartbeatTopic,
      status: nextStatusTopic,
    });

    previousAvailabilityTopicRef.current = nextAvailabilityTopic;
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

  const doConnect = useCallback(
    (host: string, port: string, topic: string) => {
      if (!host || !port) return;

      const brokerUrl = resolveBrokerUrl(host, port);

      // Always disconnect existing client to ensure clean state
      if (clientRef.current) {
        debugLog("Closing previous MQTT connection...");
        try {
          clientRef.current.end(true);
        } catch (err) {
          debugLog("Error closing previous client:", err);
        }
        clientRef.current = null;
        currentBrokerUrlRef.current = null;
        subscribedTopicsRef.current.clear();
      }

      // Skip if broker URL hasn't changed and we're already connected
      if (currentBrokerUrlRef.current === brokerUrl) {
        debugLog("MQTT already connected to:", brokerUrl);
        return;
      }

      debugLog("Connecting to MQTT:", brokerUrl);

      try {
        const client = mqtt.connect(brokerUrl, {
          clientId: clientIdRef.current,
          clean: false,
          connectTimeout: 30000,
          reconnectPeriod: getReconnectDelay(),
          keepalive: appStateRef.current === "active" ? 60 : 120, // Longer keepalive in background
          resubscribe: true,
          queueQoSZero: true,
          reschedulePings: true,
          protocolVersion: 4,
        });

        client.on("connect", () => {
          debugLog("MQTT Connected");
          connectionTimeRef.current = Date.now();
          reconnectAttemptsRef.current = 0;
          currentBrokerUrlRef.current = brokerUrl;
          subscribedTopicsRef.current.clear();
          setState({ connected: true, error: null });
          updateAvailabilitySubscription(topic);
        });

        client.on("message", (topic, payload, packet) => {
          if (isBaseMcuTopic(topic, "availability")) {
            // Simple availability marker (backward compatible)
            const isOnline = payload.toString() === "online";
            debugLog("MCU availability:", isOnline ? "online" : "offline");

            if (isOnline) {
              lastHeartbeatRef.current = Date.now();
              updateMcuOnline(true);
            } else {
              resetMcuHeartbeatTracking();
              updateMcuOnline(false);
            }
          } else if (
            isBaseMcuTopic(topic, "heartbeat") ||
            isBaseMcuTopic(topic, "status")
          ) {
            // Parse JSON heartbeat with timestamp
            try {
              const payloadStr = payload.toString();
              const data = JSON.parse(payloadStr);

              if (data.status !== "online") {
                return;
              }

              const mcuTimestamp =
                typeof data.ts === "number" ? data.ts * 1000 : 0;
              const hasFreshTimestamp = isFreshMcuTimestamp(mcuTimestamp);

              if (packet.retain && !hasFreshTimestamp) {
                debugLog(
                  "Ignoring stale retained MCU status payload:",
                  payloadStr,
                );
                return;
              }

              if (hasFreshTimestamp) {
                lastHeartbeatTimestampRef.current = mcuTimestamp;
              } else {
                lastHeartbeatTimestampRef.current = 0;
              }

              lastHeartbeatRef.current = Date.now();
              updateMcuOnline(true);

              if (!hasFreshTimestamp) {
                debugLog(
                  "MCU heartbeat received before clock sync; using arrival time fallback",
                );
              } else {
                // Optional: Matikan log ini karena dipanggil terlalu sering
                // debugLog("MCU heartbeat received:", {
                //   status: data.status,
                //   ts: new Date(mcuTimestamp).toISOString(),
                //   uptime: data.uptime,
                // });
              }
            } catch (err) {
              // Payload bukan JSON, skip
              debugLog(
                "Failed to parse heartbeat payload:",
                payload.toString(),
              );
            }
          }
        });

        client.on("error", (err) => {
          debugLog("MQTT Error:", err.message);
          setState({ connected: false, error: err.message });
        });

        client.on("offline", () => {
          debugLog("MQTT Offline");
          setState((prev) => ({ ...prev, connected: false }));
        });

        client.on("reconnect", () => {
          debugLog("MQTT Reconnecting");
          reconnectAttemptsRef.current += 1;
          setState((prev) => ({ ...prev, connected: false }));
        });

        client.on("close", () => {
          debugLog("MQTT Closed");
          setState((prev) => ({ ...prev, connected: false }));
          resetMcuHeartbeatTracking();
          updateMcuOnline(false);
          subscribedTopicsRef.current.clear();
          if (currentBrokerUrlRef.current === brokerUrl) {
            currentBrokerUrlRef.current = null;
          }
        });

        clientRef.current = client;
      } catch (err: any) {
        debugLog("MQTT Connection Error:", err.message);
        setState({ connected: false, error: err.message });
      }
    },
    [resolveBrokerUrl, updateAvailabilitySubscription],
  );

  useEffect(() => {
    if (remoteHost && remotePort) {
      doConnect(remoteHost, remotePort, mqttTopicRef.current);
    }
  }, [remoteHost, remotePort, doConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        debugLog("Cleaning up MQTT on unmount");
        clientRef.current.end(true);
        clientRef.current = null;
      }
      subscribedTopicsRef.current.clear();
      resetMcuHeartbeatTracking();
      updateMcuOnline(false);
    };
  }, [resetMcuHeartbeatTracking, updateMcuOnline]);

  useEffect(() => {
    mqttTopicRef.current = mqttTopic;
    updateAvailabilitySubscription(mqttTopic);
  }, [mqttTopic, updateAvailabilitySubscription]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      debugLog(`AppState changed: ${previousState} -> ${nextState}`);

      if (
        previousState.match(/inactive|background/) &&
        nextState === "active"
      ) {
        // App resumed from background
        debugLog("App resumed from background");

        // Check if connection is still alive
        if (clientRef.current && clientRef.current.connected) {
          debugLog("MQTT connection still alive, keeping it");
          // Just resubscribe to availability topic to sync status
          updateAvailabilitySubscription(mqttTopicRef.current);
        } else {
          // Connection lost, do reconnect
          debugLog("MQTT connection lost, forcing reconnect");
          if (clientRef.current) {
            clientRef.current.end(true);
            clientRef.current = null;
            currentBrokerUrlRef.current = null;
          }
          reconnectAttemptsRef.current = 0;

          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (remoteHost && remotePort) {
              doConnect(remoteHost, remotePort, mqttTopicRef.current);
            }
          }, 300); // Faster reconnect when resuming
        }
      } else if (nextState === "background") {
        // App going to background - keep connection alive
        debugLog("App going to background - maintaining MQTT connection");
        if (reconnectTimer) clearTimeout(reconnectTimer);

        // Don't close connection, let it keep alive with longer keepalive
      } else if (nextState === "inactive") {
        // App is inactive (about to sleep)
        debugLog("App becoming inactive");
        if (reconnectTimer) clearTimeout(reconnectTimer);
      }
    });

    return () => {
      subscription.remove();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [remoteHost, remotePort, doConnect, updateAvailabilitySubscription]);

  // Heartbeat timeout check with dual mechanism:
  // 1. Simple availability timeout (basic, fast)
  // 2. Timestamp-based check (accurate, from MCU clock)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;

      if (mcuOnline && lastHeartbeatRef.current > 0) {
        // Mechanism 1: Simple timeout check
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          debugLog(
            `Heartbeat timeout - no message for ${timeSinceLastHeartbeat}ms, marking MCU offline`,
          );
          resetMcuHeartbeatTracking();
          updateMcuOnline(false);
        }

        // Mechanism 2: Timestamp-based check (jika MCU timestamp tersedia)
        if (lastHeartbeatTimestampRef.current > 0) {
          const mcuAge = now - lastHeartbeatTimestampRef.current;
          if (mcuAge > HEARTBEAT_TIMEOUT_MS * 2) {
            // MCU timestamp sangat ketinggalan
            debugLog(
              `MCU timestamp stale (${mcuAge}ms behind), marking offline`,
            );
            resetMcuHeartbeatTracking();
            updateMcuOnline(false);
          }
        }
      }
    }, 2000); // Check every 2 seconds for faster detection

    return () => clearInterval(interval);
  }, [mcuOnline, resetMcuHeartbeatTracking, updateMcuOnline]);

  // Connection health check and preventive reconnect
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      const now = Date.now();
      const connectionAge = now - connectionTimeRef.current;

      // Check if connection seems stale in background
      if (
        appStateRef.current !== "active" &&
        clientRef.current &&
        clientRef.current.connected &&
        connectionAge > 300000 // 5 minutes
      ) {
        debugLog("Connection stale in background, doing preventive reconnect");
        if (clientRef.current) {
          clientRef.current.end(true);
          clientRef.current = null;
          currentBrokerUrlRef.current = null;
        }
        reconnectAttemptsRef.current = 0;

        if (remoteHost && remotePort) {
          doConnect(remoteHost, remotePort, mqttTopicRef.current);
        }
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(healthCheckInterval);
  }, [remoteHost, remotePort, doConnect]);

  const subscribe = useCallback((topic: string) => {
    if (clientRef.current) {
      if (clientRef.current.connected) {
        if (subscribedTopicsRef.current.has(topic)) {
          return;
        }
        debugLog("Subscribing to:", topic);
        clientRef.current.subscribe(topic);
        subscribedTopicsRef.current.add(topic);
      } else {
        debugLog("Cannot subscribe - MQTT not connected:", topic);
      }
    }
  }, []);

  const publish = useCallback(
    (topic: string, message: string, options?: mqtt.IClientPublishOptions) => {
      if (clientRef.current) {
        if (clientRef.current.connected) {
          clientRef.current.publish(
            topic,
            message,
            options || { qos: 1, retain: false }, // Default QoS 1 untuk reliability
          );
        } else {
          debugLog("Cannot publish - MQTT not connected:", topic);
        }
      }
    },
    [],
  );

  const onMessage = useCallback(
    (callback: (topic: string, message: Buffer) => void) => {
      const client = clientRef.current;
      if (client) {
        const listener = (topic: string, m: Buffer) => callback(topic, m);
        client.on("message", listener);
        return () => {
          client.removeListener("message", listener);
        };
      }
      return () => {};
    },
    [],
  );

  const reconnect = useCallback(
    (host: string, port: string, topic?: string) => {
      const normalizedHost = host || APP_DEFAULTS.mqttHost;
      const normalizedPort = port || APP_DEFAULTS.mqttPort;
      const normalizedTopic = topic || mqttTopic || APP_DEFAULTS.mqttTopic;

      const hostChanged = normalizedHost !== remoteHost;
      const portChanged = normalizedPort !== remotePort;
      const topicChanged = normalizedTopic !== mqttTopic;

      if (topicChanged) {
        setMqttTopic(normalizedTopic);
      }

      if (hostChanged) setRemoteHost(normalizedHost);
      if (portChanged) setRemotePort(normalizedPort);

      if (
        !hostChanged &&
        !portChanged &&
        !clientRef.current &&
        normalizedHost &&
        normalizedPort
      ) {
        doConnect(normalizedHost, normalizedPort, normalizedTopic);
      }
    },
    [doConnect, mqttTopic, remoteHost, remotePort],
  );

  return (
    <MqttContext.Provider
      value={{
        ...state,
        subscribe,
        publish,
        onMessage,
        reconnect,
        mcuOnline,
        mqttTopic,
      }}
    >
      {children}
    </MqttContext.Provider>
  );
}

export function useMqttContext() {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error("useMqttContext must be used within a MqttProvider");
  }
  return context;
}
