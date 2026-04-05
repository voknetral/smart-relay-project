# Menambahkan Perangkat (Relay) pada ESP32

Aplikasi React Native mendukung penambahan perangkat (card) tanpa batas.
Setiap perangkat baru akan otomatis mendapatkan ID berurutan (`5`, `6`, `7`, dan seterusnya).

Agar ESP32 dapat mengontrol perangkat baru tersebut, perlu dilakukan penambahan sedikit di kode firmware.

---

## Langkah 1: Menentukan GPIO Baru

Pilih pin GPIO yang tersedia pada ESP32 untuk relay baru, lalu tambahkan di file `esp32_mqtt.ino`:

```cpp id="b0u6jk"
// Relay Pins Definition
#define RELAY_PIN_1 16
#define RELAY_PIN_2 17
#define RELAY_PIN_3 18
#define RELAY_PIN_4 19

// Relay tambahan
#define RELAY_PIN_5 21
```

> Pastikan GPIO yang digunakan tidak bentrok dengan pin lain atau pin khusus (boot/flash).

---

## Langkah 2: Mendaftarkan Perangkat

Cari bagian deklarasi `Device devices[]`, lalu tambahkan device baru sesuai ID dari aplikasi:

```cpp id="z9l7u0"
Device devices[] = {
  {"1", RELAY_PIN_1, "", "", "", "", ""},
  {"2", RELAY_PIN_2, "", "", "", "", ""},
  {"3", RELAY_PIN_3, "", "", "", "", ""},
  {"4", RELAY_PIN_4, "", "", "", "", ""},
  {"5", RELAY_PIN_5, "", "", "", "", ""} // misal mau tambah relay 5 dengan id 5
};
```

---

## Cara Kerja

Tidak diperlukan perubahan tambahan pada kode utama.

Sistem akan secara otomatis menyesuaikan berdasarkan isi array `devices[]`:

* Subscribe ke topik MQTT baru
* Sinkronisasi status perangkat ke aplikasi
* Menjalankan timer dan jadwal secara mandiri untuk setiap perangkat

---

## Perilaku Aplikasi

* Jika card baru belum diprogram di firmware → card tersebut akan ditandai offline
* Jika ESP32 terputus dari MQTT → semua perangkat ditandai offline

Hal ini untuk mencegah pengiriman perintah saat koneksi tidak tersedia.

---

## Ringkasan

Untuk menambahkan perangkat baru:

1. Tambahkan definisi GPIO
2. Tambahkan ke array `devices[]`

Tidak perlu mengubah fungsi utama seperti `setup()` atau `loop()`.

---
