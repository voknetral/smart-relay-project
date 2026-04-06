import { APP_DEFAULTS } from "@/constants/Config";
import { SmartHomeColors } from "@/constants/theme";
import { AppLanguage } from "@/constants/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMqttContext } from "@/contexts/MqttContext";
import { AppConfig, Storage } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as IntentLauncher from "expo-intent-launcher";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const bottomBarHeight = Math.max(insets.bottom, 16) + 8;
  const bottomScrollPadding = Platform.OS === "android" ? 8 : 24;
  const { TXT, language, setLanguage } = useLanguage();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [username, setUsername] = useState("");
  const [selectedLanguage, setSelectedLanguage] =
    useState<AppLanguage>(language);
  const [mqttTopic, setMqttTopic] = useState("");
  const [mqttHost, setMqttHost] = useState("");
  const [mqttPort, setMqttPort] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [captureConsoleLogs, setCaptureConsoleLogs] = useState(false);

  const [isResultModalVisible, setIsResultModalVisible] = useState(false);

  // General Status Modal States (Confirm/Success)
  const [statusModal, setStatusModal] = useState({
    visible: false,
    title: "",
    message: "",
    type: "info" as "info" | "confirm" | "danger",
    onConfirm: () => {},
  });

  const {
    connected: mqttConnected,
    subscribe,
    reconnect,
    mcuOnline,
  } = useMqttContext();

  // Effect for auto-subscribing when checking and connection succeeds
  useEffect(() => {
    if (isChecking && mqttConnected) {
      subscribe(`${mqttTopic}/availability`);
    }
  }, [isChecking, mqttConnected, mqttTopic, subscribe]);

  useEffect(() => {
    const loadConfig = async () => {
      const savedConfig = await Storage.loadConfig();
      if (savedConfig) {
        setConfig(savedConfig);
        setUsername(savedConfig.username);
        setSelectedLanguage(savedConfig.language || language);
        setMqttTopic(savedConfig.mqttTopic!);
        setMqttHost(savedConfig.mqttHost!);
        setMqttPort(savedConfig.mqttPort!);
        setCaptureConsoleLogs(savedConfig.captureConsoleLogs || false);
      }
    };
    loadConfig();
  }, [language]);

  const handleCheckConnection = () => {
    // Validasi port sebelum mencoba connect
    const portNum = parseInt(mqttPort, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      const errorTitle = "Port Tidak Valid";
      const errorMessage = "Silakan masukkan nomor port antara 1 - 65535.";

      if (Platform.OS === "web") {
        window.alert(`${errorTitle}\n\n${errorMessage}`);
      } else {
        Alert.alert(errorTitle, errorMessage);
      }
      return;
    }

    // Jangan mereset mcuResultOnline(false) secara paksa jika indikator sudah terbukti nyala.
    // Broker MQTT publik (HiveMQ) rata-rata MENGAMBAIKAN perintah "subscribe" ulang
    // ke topik yang sama, jadi pesan 'online' tidak akan dikirim kedua kalinya.

    // Update connection target to whatever is currently typed
    reconnect(mqttHost, mqttPort);

    setIsChecking(true);

    // Wait a bit to show result
    setTimeout(() => {
      setIsChecking(false);
      setIsResultModalVisible(true);
    }, 3000); // Show modal after 3s
  };

  const handleSave = async () => {
    if (!username.trim() || !config) return;
    const newConfig = {
      ...config,
      username: username.trim(),
      language: selectedLanguage,
      mqttTopic: mqttTopic.trim() || APP_DEFAULTS.mqttTopic,
      mqttHost: mqttHost.trim() || APP_DEFAULTS.mqttHost,
      mqttPort: mqttPort.trim() || APP_DEFAULTS.mqttPort,
      captureConsoleLogs: captureConsoleLogs,
    };
    await Storage.saveConfig(newConfig);
    setLanguage(selectedLanguage);

    // Trigger global reconnection with new settings including topic
    reconnect(newConfig.mqttHost, newConfig.mqttPort, newConfig.mqttTopic);

    router.back();
  };

  const isSaveDisabled = !username.trim();

  const handleResetDefaults = () => {
    setStatusModal({
      visible: true,
      title: "Konfirmasi Reset",
      message: `Kembalikan ke pengaturan awal?\n\nHost: ${APP_DEFAULTS.mqttHost}\nPort: ${APP_DEFAULTS.mqttPort}\nTopik: ${APP_DEFAULTS.mqttTopic}`,
      type: "confirm",
      onConfirm: performResetDefaults,
    });
  };

  const performResetDefaults = async () => {
    setMqttTopic(() => APP_DEFAULTS.mqttTopic);
    setMqttHost(() => APP_DEFAULTS.mqttHost);
    setMqttPort(() => APP_DEFAULTS.mqttPort);

    if (config) {
      const newConfig = {
        ...config,
        mqttTopic: APP_DEFAULTS.mqttTopic,
        mqttHost: APP_DEFAULTS.mqttHost,
        mqttPort: APP_DEFAULTS.mqttPort,
      };
      await Storage.saveConfig(newConfig);
      setConfig(newConfig);
      reconnect(newConfig.mqttHost, newConfig.mqttPort, newConfig.mqttTopic);

      setStatusModal({
        visible: true,
        title: "Berhasil",
        message: `Pengaturan MQTT telah dikembalikan:\n\nHost: ${APP_DEFAULTS.mqttHost}\nPort: ${APP_DEFAULTS.mqttPort}\nTopik: ${APP_DEFAULTS.mqttTopic}`,
        type: "info",
        onConfirm: () =>
          setStatusModal((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const handleReset = () => {
    setStatusModal({
      visible: true,
      title: TXT.settings.resetApp,
      message: TXT.settings.resetConfirm,
      type: "danger",
      onConfirm: performAppReset,
    });
  };

  const [isBatteryExempt, setIsBatteryExempt] = useState(true);

  const checkBatteryStatus = async () => {
    if (Platform.OS === "android") {
      const isOptimized = await Battery.isBatteryOptimizationEnabledAsync();
      setIsBatteryExempt(!isOptimized);
    }
  };

  useEffect(() => {
    checkBatteryStatus();
    const interval = setInterval(checkBatteryStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBatteryExemption = async () => {
    if (Platform.OS !== "android") return;

    const pkg = Application.applicationId;
    if (!pkg) return;

    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        {
          data: `package:${pkg}`,
        },
      );
    } catch {
      // Fallback to general settings if specific intent fails
      IntentLauncher.startActivityAsync(
        "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
      );
    }
  };

  const performAppReset = async () => {
    await Storage.clearConfig();
    router.replace("/");
  };

  if (!config) return null;

  return (
    <View style={{ flex: 1, backgroundColor: SmartHomeColors.cardBg }}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.customHeader}>
          <View style={styles.headerSideSlot}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={SmartHomeColors.textPrimary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {TXT.common.settings}
            </Text>
          </View>
          <View style={[styles.headerSideSlot, styles.headerSideSlotRight]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaveDisabled}
              style={[styles.headerSaveBtn, isSaveDisabled && { opacity: 0.5 }]}
            >
              <Text style={styles.headerSaveText}>{TXT.common.save}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoiding}
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 12}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomScrollPadding },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Profile Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{TXT.settings.profile}</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{TXT.setup.whatIsName}</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={TXT.setup.placeholderName}
                  placeholderTextColor={SmartHomeColors.textMuted}
                />
              </View>
            </View>

            <View style={[styles.section, styles.borderTop]}>
              <Text style={styles.sectionTitle}>{TXT.settings.language}</Text>
              <View style={styles.languageRow}>
                <TouchableOpacity
                  style={[
                    styles.languageChip,
                    selectedLanguage === "en" && styles.languageChipActive,
                  ]}
                  onPress={() => setSelectedLanguage("en")}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      selectedLanguage === "en" &&
                        styles.languageChipTextActive,
                    ]}
                  >
                    {TXT.settings.english}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageChip,
                    selectedLanguage === "id" && styles.languageChipActive,
                  ]}
                  onPress={() => setSelectedLanguage("id")}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      selectedLanguage === "id" &&
                        styles.languageChipTextActive,
                    ]}
                  >
                    {TXT.settings.indonesian}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* MQTT Section */}
            <View style={[styles.section, styles.borderTop]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {TXT.settings.mqttSection}
                </Text>
                <TouchableOpacity
                  onPress={handleResetDefaults}
                  activeOpacity={0.6}
                  style={styles.resetLinkContainer}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={14}
                    color={SmartHomeColors.purple}
                  />
                  <Text style={styles.resetLink}>{TXT.settings.resetMqtt}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{TXT.settings.mqttTopic}</Text>
                <TextInput
                  style={styles.input}
                  value={mqttTopic}
                  onChangeText={setMqttTopic}
                  placeholder={TXT.settings.mqttTopicPlaceholder}
                  placeholderTextColor={SmartHomeColors.textMuted}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{TXT.settings.mqttHost}</Text>
                <TextInput
                  style={styles.input}
                  value={mqttHost}
                  onChangeText={setMqttHost}
                  placeholder={TXT.settings.mqttHostPlaceholder}
                  placeholderTextColor={SmartHomeColors.textMuted}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{TXT.settings.mqttPort}</Text>
                <TextInput
                  style={styles.input}
                  value={mqttPort}
                  onChangeText={setMqttPort}
                  placeholder={TXT.settings.mqttPortPlaceholder}
                  placeholderTextColor={SmartHomeColors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
              <TouchableOpacity
                onPress={handleCheckConnection}
                disabled={isChecking}
                style={[styles.checkBtn, isChecking && { opacity: 0.7 }]}
              >
                <Ionicons
                  name="pulse"
                  size={18}
                  color={SmartHomeColors.purple}
                />
                <Text style={styles.checkBtnText}>
                  {isChecking
                    ? TXT.settings.checking
                    : TXT.settings.checkConnection}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Battery Optimization Section (Android Only) */}
            {Platform.OS === "android" && (
              <View style={[styles.section, styles.borderTop]}>
                <View style={styles.sectionHeaderCenter}>
                  <Text style={styles.sectionTitle}>
                    {TXT.settings.batteryOptimization}
                  </Text>
                  <View style={styles.experimentalBadge}>
                    <Ionicons name="flask-outline" size={13} color="#B45309" />
                    <Text style={styles.experimentalBadgeText}>
                      {TXT.settings.experimental}
                    </Text>
                  </View>
                </View>
                <View style={styles.batteryCard}>
                  <View style={styles.batteryInfo}>
                    <View
                      style={[
                        styles.batteryIconWrap,
                        isBatteryExempt
                          ? styles.batteryIconWrapSafe
                          : styles.batteryIconWrapWarn,
                      ]}
                    >
                      <Ionicons
                        name={isBatteryExempt ? "battery-full" : "battery-dead"}
                        size={22}
                        color={isBatteryExempt ? "#10B981" : "#F59E0B"}
                      />
                    </View>
                    <View style={styles.batteryTextWrap}>
                      <Text style={styles.batteryTitle}>
                        {isBatteryExempt
                          ? TXT.settings.batteryDisabled
                          : TXT.settings.batteryEnabled}
                      </Text>
                      <Text style={styles.batteryDesc}>
                        {isBatteryExempt
                          ? TXT.settings.batteryDisabledDesc
                          : TXT.settings.batteryEnabledDesc}
                      </Text>
                    </View>
                  </View>

                  {!isBatteryExempt && (
                    <>
                      <TouchableOpacity
                        style={styles.batteryBtn}
                        onPress={handleBatteryExemption}
                      >
                        <Text style={styles.batteryBtnText}>
                          {TXT.settings.disableOptimization}
                        </Text>
                        <Ionicons name="open-outline" size={16} color="#FFF" />
                      </TouchableOpacity>
                      <Text style={styles.batteryButtonHint}>
                        {TXT.settings.batterySettingsHint}
                      </Text>
                    </>
                  )}

                  <View style={styles.batteryNoticeBox}>
                    <View style={styles.batteryNoticeRow}>
                      <Ionicons
                        name="notifications-outline"
                        size={15}
                        color={SmartHomeColors.purple}
                      />
                      <Text style={styles.batteryNoticeText}>
                        {TXT.settings.batteryHint}
                      </Text>
                    </View>
                    <View style={styles.batteryNoticeRow}>
                      <Ionicons
                        name="flask-outline"
                        size={15}
                        color="#B45309"
                      />
                      <Text style={styles.batteryNoticeText}>
                        {TXT.settings.batteryExperimentalNote}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Danger Zone */}
            <View
              style={[styles.section, styles.borderTop, { marginBottom: 20 }]}
            >
              <Text style={styles.sectionTitle}>{TXT.settings.about}</Text>
              <TouchableOpacity
                onPress={() => {
                  setCaptureConsoleLogs(!captureConsoleLogs);
                  // Auto-save immediately
                  if (config) {
                    const updatedConfig = {
                      ...config,
                      captureConsoleLogs: !captureConsoleLogs,
                    };
                    Storage.saveConfig(updatedConfig);
                    setConfig(updatedConfig);
                  }
                }}
                style={styles.logsBtn}
              >
                <Ionicons
                  name={captureConsoleLogs ? "recording" : "recording-outline"}
                  size={18}
                  color={
                    captureConsoleLogs ? "#EF4444" : SmartHomeColors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.logsBtnText,
                    captureConsoleLogs && { color: "#EF4444" },
                  ]}
                >
                  {TXT.common.captureConsoleLogs || "Capture Console Logs"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/logs")}
                style={styles.logsBtn}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={SmartHomeColors.purple}
                />
                <Text style={styles.logsBtnText}>
                  {TXT.common.applicationLogs || "Application Logs"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.resetText}>{TXT.settings.resetApp}</Text>
              </TouchableOpacity>
              <View style={styles.versionContainer}>
                <Text style={styles.hint}>Version 1.2.5 | Build 2024.03</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          pointerEvents="none"
          style={[styles.bottomNavbarFill, { height: bottomBarHeight }]}
        />

        <Modal
          animationType="fade"
          transparent={true}
          statusBarTranslucent={true}
          visible={isResultModalVisible}
          onRequestClose={() => setIsResultModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconBg}>
                  <Ionicons
                    name="shield-checkmark"
                    size={32}
                    color={SmartHomeColors.purple}
                  />
                </View>
                <Text style={styles.modalTitle}>
                  {TXT.settings.connectionDetails}
                </Text>
              </View>

              <View style={styles.modalContent}>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusIcon,
                      mqttConnected
                        ? styles.statusIconOnline
                        : styles.statusIconOffline,
                    ]}
                  >
                    <Ionicons
                      name={mqttConnected ? "checkmark-circle" : "close-circle"}
                      size={22}
                      color={mqttConnected ? "#10B981" : "#EF4444"}
                    />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusLabel}>MQTT Broker</Text>
                    <Text
                      style={[
                        styles.statusValue,
                        mqttConnected ? styles.textOnline : styles.textOffline,
                      ]}
                    >
                      {mqttConnected
                        ? TXT.settings.online
                        : TXT.settings.offline}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusIcon,
                      mqttConnected && mcuOnline
                        ? styles.statusIconOnline
                        : styles.statusIconOffline,
                    ]}
                  >
                    <Ionicons
                      name={
                        mqttConnected && mcuOnline
                          ? "checkmark-circle"
                          : "close-circle"
                      }
                      size={22}
                      color={mqttConnected && mcuOnline ? "#10B981" : "#EF4444"}
                    />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusLabel}>MCU Status</Text>
                    <Text
                      style={[
                        styles.statusValue,
                        mqttConnected && mcuOnline
                          ? styles.textOnline
                          : styles.textOffline,
                      ]}
                    >
                      {mqttConnected && mcuOnline
                        ? TXT.settings.online
                        : TXT.settings.offline}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsResultModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseBtnText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Status Modal (Generic for Confirm/Success) */}
        <Modal
          animationType="fade"
          transparent={true}
          statusBarTranslucent={true}
          visible={statusModal.visible}
          onRequestClose={() =>
            setStatusModal((prev) => ({ ...prev, visible: false }))
          }
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalIconBg,
                    statusModal.type === "info"
                      ? styles.statusIconOnline
                      : styles.statusIconOffline,
                  ]}
                >
                  <Ionicons
                    name={
                      statusModal.type === "info"
                        ? "checkmark-circle"
                        : "warning"
                    }
                    size={32}
                    color={statusModal.type === "info" ? "#10B981" : "#EF4444"}
                  />
                </View>
                <Text style={styles.modalTitle}>{statusModal.title}</Text>
              </View>

              <Text
                style={[
                  styles.modalMessage,
                  { textAlign: "center", marginBottom: 24 },
                ]}
              >
                {statusModal.message}
              </Text>

              <View style={styles.modalFooter}>
                {statusModal.type !== "info" ? (
                  <>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnSecondary]}
                      onPress={() =>
                        setStatusModal((prev) => ({ ...prev, visible: false }))
                      }
                    >
                      <Text style={styles.modalBtnTextSecondary}>BATAL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalBtn,
                        statusModal.type === "danger"
                          ? styles.modalBtnDanger
                          : styles.modalBtnPrimary,
                      ]}
                      onPress={() => {
                        setStatusModal((prev) => ({ ...prev, visible: false }));
                        statusModal.onConfirm();
                      }}
                    >
                      <Text style={styles.modalBtnTextPrimary}>
                        {statusModal.type === "danger"
                          ? "YA, HAPUS"
                          : "YA, RESET"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      styles.modalBtnPrimary,
                      { width: "100%" },
                    ]}
                    onPress={() =>
                      setStatusModal((prev) => ({ ...prev, visible: false }))
                    }
                  >
                    <Text style={styles.modalBtnTextPrimary}>OK</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SmartHomeColors.cardBg,
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: SmartHomeColors.cardBg,
  },
  headerSideSlot: {
    width: 96,
    justifyContent: "center",
  },
  headerSideSlotRight: {
    alignItems: "flex-end",
  },
  headerBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  headerTitleContainer: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: SmartHomeColors.textPrimary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  bottomNavbarFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: SmartHomeColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionHeaderCenter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  resetLink: {
    fontSize: 13,
    fontWeight: "700",
    color: SmartHomeColors.purple,
  },
  resetLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
  },
  headerSaveBtn: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    minWidth: 96,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  headerSaveText: {
    color: SmartHomeColors.purple,
    fontWeight: "800",
    fontSize: 14,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 24,
  },
  inputGroup: {
    gap: 8,
  },
  languageRow: {
    flexDirection: "row",
    gap: 10,
  },
  languageChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.03)",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  languageChipActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#C4B5FD",
  },
  languageChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: SmartHomeColors.textSecondary,
  },
  languageChipTextActive: {
    color: SmartHomeColors.purple,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: SmartHomeColors.textSecondary,
  },
  input: {
    backgroundColor: "rgba(139, 92, 246, 0.03)",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 56,
    fontSize: 16,
    color: SmartHomeColors.textPrimary,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  resetText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  logsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F3E8FF",
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  logsBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: SmartHomeColors.purple,
  },
  hint: {
    fontSize: 12,
    color: SmartHomeColors.textMuted,
    textAlign: "center",
  },
  experimentalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  experimentalBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  versionContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  saveBtnGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F3E8FF",
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  checkBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: SmartHomeColors.purple,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 28,
    width: "100%",
    maxWidth: 340,
    padding: 24,
    alignItems: "center",
    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
    elevation: 20,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
    gap: 16,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: SmartHomeColors.textPrimary,
    textAlign: "center",
  },
  modalContent: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  statusIconOnline: {
    backgroundColor: "#ECFDF5",
  },
  statusIconOffline: {
    backgroundColor: "#FEF2F2",
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: SmartHomeColors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  textOnline: {
    color: "#10B981",
  },
  textOffline: {
    color: "#EF4444",
  },
  modalCloseBtn: {
    backgroundColor: SmartHomeColors.purple,
    width: "100%",
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 4px 8px rgba(139, 92, 246, 0.2)",
    elevation: 4,
  },
  modalCloseBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalMessage: {
    fontSize: 15,
    color: SmartHomeColors.textSecondary,
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnPrimary: {
    backgroundColor: SmartHomeColors.purple,
  },
  modalBtnSecondary: {
    backgroundColor: "#F1F5F9",
  },
  modalBtnDanger: {
    backgroundColor: "#EF4444",
  },
  modalBtnTextPrimary: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  modalBtnTextSecondary: {
    color: SmartHomeColors.textSecondary,
    fontSize: 14,
    fontWeight: "800",
  },
  batteryCard: {
    backgroundColor: "#F8FAFC",
    padding: 18,
    borderRadius: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  batteryInfo: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  batteryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  batteryIconWrapSafe: {
    backgroundColor: "#ECFDF5",
  },
  batteryIconWrapWarn: {
    backgroundColor: "#FFF7ED",
  },
  batteryTextWrap: {
    flex: 1,
  },
  batteryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: SmartHomeColors.textPrimary,
    marginBottom: 4,
  },
  batteryDesc: {
    fontSize: 13,
    color: SmartHomeColors.textMuted,
    lineHeight: 20,
  },
  batteryBtn: {
    backgroundColor: SmartHomeColors.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  batteryButtonHint: {
    fontSize: 12,
    lineHeight: 18,
    color: SmartHomeColors.textMuted,
    marginTop: -2,
  },
  batteryBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  batteryNoticeBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  batteryNoticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  batteryNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: SmartHomeColors.textSecondary,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: SmartHomeColors.textPrimary,
  },
  resultSub: {
    fontSize: 13,
    color: SmartHomeColors.textSecondary,
    marginTop: 2,
  },
});
