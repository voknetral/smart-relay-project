#include <ArduinoJson.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <time.h>

// --- Configuration ---
const char *ssid = "TEKNOLAB Office";
const char *password = "selamatdatang";

// MQTT Configuration
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char *base_topic = "anomali/device"; // Base topic for all devices

// Relay Pins Definition
#define RELAY_PIN_1 16
#define RELAY_PIN_2 17
#define RELAY_PIN_3 18
#define RELAY_PIN_4 19

// Relay Logic (Active High)
#define RELAY_ON HIGH
#define RELAY_OFF LOW

// NTP Settings
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7 * 3600; // WIB (UTC+7)
const int daylightOffset_sec = 0;

// Device Definitions
struct Device {
  const char *id;
  int pin;
  String topic_set;
  String topic_state;
  String topic_schedule;
  String topic_mode_set;
  String topic_mode_state;
};

Device devices[] = {{"1", RELAY_PIN_1, "", "", "", "", ""},
                    {"2", RELAY_PIN_2, "", "", "", "", ""},
                    {"3", RELAY_PIN_3, "", "", "", "", ""},
                    {"4", RELAY_PIN_4, "", "", "", "", ""}};

const int NUM_DEVICES = sizeof(devices) / sizeof(Device);

// Dynamic Shared Topics
String availabilityTopic;
String getTopic;

WiFiClient espClient;
PubSubClient client(espClient);
Preferences preferences;

// State tracking
int last_minute_triggered = -1;
unsigned long last_reconnect_attempt = 0;

void setup_wifi() {
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);
}

void saveSchedules(int deviceIdx, String json) {
  preferences.begin("anomali", false);
  preferences.putString(("sch_" + String(devices[deviceIdx].id)).c_str(), json);
  preferences.end();
}

String loadSchedules(int deviceIdx) {
  preferences.begin("anomali", true);
  String json = preferences.getString(
      ("sch_" + String(devices[deviceIdx].id)).c_str(), "[]");
  preferences.end();
  return json;
}

void saveMode(int deviceIdx, String mode) {
  preferences.begin("anomali", false);
  preferences.putString(("mode_" + String(devices[deviceIdx].id)).c_str(),
                        mode);
  preferences.end();
}

String loadMode(int deviceIdx) {
  preferences.begin("anomali", true);
  String mode = preferences.getString(
      ("mode_" + String(devices[deviceIdx].id)).c_str(), "auto");
  preferences.end();
  return mode;
}

void callback(char *topic, byte *payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++)
    message += (char)payload[i];

  for (int i = 0; i < NUM_DEVICES; i++) {
    if (String(topic) == devices[i].topic_set) {
      bool newState = (message == "ON");
      digitalWrite(devices[i].pin, newState ? RELAY_ON : RELAY_OFF);
      client.publish(devices[i].topic_state.c_str(), newState ? "ON" : "OFF",
                     true);
      break;
    } else if (String(topic) == devices[i].topic_schedule) {
      saveSchedules(i, message);
      break;
    } else if (String(topic) == devices[i].topic_mode_set) {
      if (message == "auto" || message == "manual") {
        saveMode(i, message);
        client.publish(devices[i].topic_mode_state.c_str(), message.c_str(),
                       true);
      }
      break;
    } else if (String(topic) == getTopic) {
      // Sync all device states
      for (int j = 0; j < NUM_DEVICES; j++) {
        client.publish(devices[j].topic_state.c_str(),
                       (digitalRead(devices[j].pin) == RELAY_ON) ? "ON" : "OFF",
                       true);
        client.publish(devices[j].topic_mode_state.c_str(), loadMode(j).c_str(),
                       true);
      }
      break;
    }
  }
}

boolean reconnect() {
  String clientId = "Anomali-MCU-" + String(random(0xffff), HEX);
  if (client.connect(clientId.c_str(), availabilityTopic.c_str(), 0, true,
                     "offline")) {
    client.publish(availabilityTopic.c_str(), "online", true);
    for (int i = 0; i < NUM_DEVICES; i++) {
      client.subscribe(devices[i].topic_set.c_str());
      client.subscribe(devices[i].topic_schedule.c_str());
      client.subscribe(devices[i].topic_mode_set.c_str());
    }
    client.subscribe(getTopic.c_str());

    // Sync current state back to app on initial connection
    for (int i = 0; i < NUM_DEVICES; i++) {
      client.publish(devices[i].topic_state.c_str(),
                     (digitalRead(devices[i].pin) == RELAY_ON) ? "ON" : "OFF",
                     true);
      client.publish(devices[i].topic_mode_state.c_str(), loadMode(i).c_str(),
                     true);
    }
    return true;
  }
  return false;
}

void checkSchedules() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo))
    return;

  // Prevent multiple triggers in the same minute
  if (timeinfo.tm_min == last_minute_triggered)
    return;
  last_minute_triggered = timeinfo.tm_min;

  char currentTime[6];
  sprintf(currentTime, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
  Serial.print("Checking schedules for: ");
  Serial.println(currentTime);

  for (int i = 0; i < NUM_DEVICES; i++) {
    if (loadMode(i) != "auto")
      continue;

    String json = loadSchedules(i);
    JsonDocument doc;
    if (deserializeJson(doc, json))
      continue;

    for (JsonObject s : doc.as<JsonArray>()) {
      if (!s["isEnabled"])
        continue;

      const char* startTime = s["startTime"].as<const char*>();
      const char* endTime = s["endTime"].as<const char*>();

      if (startTime && strcmp(currentTime, startTime) == 0) {
        digitalWrite(devices[i].pin, RELAY_ON);
        client.publish(devices[i].topic_state.c_str(), "ON", true);
      } else if (endTime && strcmp(currentTime, endTime) == 0) {
        digitalWrite(devices[i].pin, RELAY_OFF);
        client.publish(devices[i].topic_state.c_str(), "OFF", true);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize topics dynamically
  availabilityTopic = String(base_topic) + "/availability";
  getTopic = String(base_topic) + "/get";

  for (int i = 0; i < NUM_DEVICES; i++) {
    String deviceBase = String(base_topic) + "/" + String(devices[i].id);
    devices[i].topic_set = deviceBase + "/set";
    devices[i].topic_state = deviceBase + "/state";
    devices[i].topic_schedule = deviceBase + "/schedule";
    devices[i].topic_mode_set = deviceBase + "/mode/set";
    devices[i].topic_mode_state = deviceBase + "/mode/state";

    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, RELAY_OFF);
  }

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // Init NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      unsigned long now = millis();
      if (now - last_reconnect_attempt > 5000) {
        last_reconnect_attempt = now;
        if (reconnect()) {
          last_reconnect_attempt = 0;
        }
      }
    } else {
      client.loop();
    }
  } else {
    // WiFi lost - non-blocking attempt to reconnect
    static unsigned long last_wifi_ms = 0;
    if (millis() - last_wifi_ms > 10000) {
      last_wifi_ms = millis();
      WiFi.begin(ssid, password);
    }
  }

  // Check schedules every few seconds (non-blocking)
  static unsigned long last_sch_ms = 0;
  if (millis() - last_sch_ms > 2000) {
    last_sch_ms = millis();
    checkSchedules();
  }
}
