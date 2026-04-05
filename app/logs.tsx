import { SmartHomeColors } from "@/constants/theme";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApplicationLog, Storage } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { router, Stack, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LogsScreen() {
  const insets = useSafeAreaInsets();
  const { TXT } = useLanguage();
  const [logs, setLogs] = useState<ApplicationLog[]>([]);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);

  const loadLogs = useCallback(async () => {
    const savedLogs = await Storage.loadApplicationLogs();
    setLogs(savedLogs.reverse());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs]),
  );

  const handleClearAll = async () => {
    await Storage.saveApplicationLogs([]);
    setLogs([]);
    setClearConfirmVisible(false);
  };

  const handleExportLogs = async () => {
    if (logs.length === 0) {
      return;
    }

    try {
      const logsText = logs
        .map(
          (log) =>
            `[${formatTime(log.timestamp)}] ${log.type.toUpperCase()}: ${log.title}\n${log.message}`,
        )
        .join("\n\n---\n\n");

      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `logs_${timestamp}.log`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // Write logs to file
      await FileSystem.writeAsStringAsync(filePath, logsText);

      // Verify file was created
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error("File creation failed");
      }

      // Share using expo-sharing for better file handling
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/plain",
          dialogTitle: "Export Logs",
        });
        Alert.alert("Success", `Logs exported to ${fileName}`);
      } else {
        Alert.alert("Info", "File saved, but sharing is not available");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to export logs");
      console.error("Error exporting logs:", error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getTypeIcon = (type: ApplicationLog["type"]) => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "warning":
        return "warning";
      case "error":
        return "close-circle";
      default:
        return "information-circle";
    }
  };

  const getTypeColor = (type: ApplicationLog["type"]) => {
    switch (type) {
      case "success":
        return "#10B981";
      case "warning":
        return "#F59E0B";
      case "error":
        return "#EF4444";
      default:
        return SmartHomeColors.purple;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: SmartHomeColors.cardBg }}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.header}>
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>
              {TXT.common.applicationLogs || "Application Logs"}
            </Text>
            {logs.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{logs.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={handleExportLogs}
            disabled={logs.length === 0}
            style={[
              styles.headerBackBtn,
              logs.length === 0 && { opacity: 0.5 },
            ]}
          >
            <Ionicons
              name="share-social-outline"
              size={20}
              color={SmartHomeColors.purple}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={SmartHomeColors.textMuted}
              />
              <Text style={styles.emptyText}>
                {TXT.common.noLogs || "No logs yet"}
              </Text>
            </View>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <View
                  style={[
                    styles.logIcon,
                    { backgroundColor: getTypeColor(log.type) + "20" },
                  ]}
                >
                  <Ionicons
                    name={getTypeIcon(log.type)}
                    size={20}
                    color={getTypeColor(log.type)}
                  />
                </View>
                <View style={styles.logContent}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logTitle}>{log.title}</Text>
                    <Text style={styles.logTime}>
                      {formatTime(log.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {logs.length > 0 && (
          <View style={styles.footerButtons}>
            <TouchableOpacity
              onPress={handleExportLogs}
              style={styles.footerBtn}
            >
              <Ionicons
                name="share-social"
                size={18}
                color={SmartHomeColors.purple}
              />
              <Text style={styles.footerBtnText}>
                {TXT.common.exportLogs || "Export"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setClearConfirmVisible(true)}
              style={[styles.footerBtn, styles.footerBtnDanger]}
            >
              <Ionicons name="trash" size={18} color="#EF4444" />
              <Text style={[styles.footerBtnText, styles.footerBtnDangerText]}>
                {TXT.common.clearAll || "Clear All"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Clear Confirmation Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          statusBarTranslucent={true}
          visible={clearConfirmVisible}
          onRequestClose={() => setClearConfirmVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconBg}>
                  <Ionicons name="warning" size={32} color="#F59E0B" />
                </View>
                <Text style={styles.modalTitle}>Clear All Logs?</Text>
              </View>

              <Text style={styles.modalMessage}>
                This action cannot be undone. All application logs will be
                permanently deleted.
              </Text>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setClearConfirmVisible(false)}
                >
                  <Text style={styles.modalBtnTextSecondary}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  onPress={handleClearAll}
                >
                  <Text style={styles.modalBtnTextPrimary}>CLEAR</Text>
                </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: SmartHomeColors.cardBg,
  },
  headerBackBtn: {
    padding: 4,
    marginLeft: -4,
    zIndex: 10,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: SmartHomeColors.textPrimary,
    letterSpacing: -0.5,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -12,
    backgroundColor: SmartHomeColors.purple,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: SmartHomeColors.textMuted,
    marginTop: 12,
    fontWeight: "600",
  },
  logItem: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  logIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logContent: {
    flex: 1,
    justifyContent: "center",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: SmartHomeColors.textPrimary,
    flex: 1,
  },
  logTime: {
    fontSize: 12,
    color: SmartHomeColors.textMuted,
    marginLeft: 8,
  },
  logMessage: {
    fontSize: 13,
    color: SmartHomeColors.textSecondary,
    lineHeight: 18,
  },
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
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: SmartHomeColors.textPrimary,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: SmartHomeColors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalFooter: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSecondary: {
    backgroundColor: "#F1F5F9",
  },
  modalBtnDanger: {
    backgroundColor: "#EF4444",
  },
  modalBtnTextSecondary: {
    color: SmartHomeColors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
  modalBtnTextPrimary: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  footerButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  footerBtnDanger: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: SmartHomeColors.purple,
  },
  footerBtnDangerText: {
    color: "#EF4444",
  },
});
