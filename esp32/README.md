Kini aplikasi React Native Anda telah mendukung penambahan "Perangkat/Card" tanpa batas! Setiap Anda menekan tombol **Tambah Perangkat** di aplikasi, ia secara otomatis akan membuat ID yang berurutan, mulai dari `5`, `6`, `7`, dan seterusnya.

Karena kode MCU (ESP32) awalnya disiapkan hanya untuk 4 relay, Anda perlu menyelaraskan kodenya agar ESP32 bisa "mendengar" instruksi dari perangkat baru tersebut.

Ikuti panduan berikut setiap kali Anda menambah *Card* baru di Aplikasi:

## Langkah 1: Sambungkan GPIO Baru
Tentukan Pin GPIO di ESP32 yang akan Anda gunakan untuk menyambungkan sambungan sinyal Relay baru.
Buka `esp32_mqtt.ino` dan tambahkan definisinya di bagian atas:

```cpp
// Relay Pins Definition
#define RELAY_PIN_1 16
#define RELAY_PIN_2 17
#define RELAY_PIN_3 18
#define RELAY_PIN_4 19
// -- TAMBAHAN ANDA --
#define RELAY_PIN_5 21 // Contoh menggunakan GPIO 21
```

## Langkah 2: Daftarkan ke Array Devices
Cari blok deklarasi `Device devices[] = {...}` dan tambahkan baris baru untuk ID "5" (atau nomor berapapun yang baru Anda buat di aplikasi).

```cpp
Device devices[] = {
  {"1", RELAY_PIN_1, "", "", "", "", ""},
  {"2", RELAY_PIN_2, "", "", "", "", ""},
  {"3", RELAY_PIN_3, "", "", "", "", ""},
  {"4", RELAY_PIN_4, "", "", "", "", ""},
  // -- TAMBAHAN ANDA --
  {"5", RELAY_PIN_5, "", "", "", "", ""}
};
```

## Langkah Mulus Tanpa Ubah Logika
Cukup dua langkah di atas! Karena sistem `loop()` maupun `setup()` dibuat secara dinamis, ESP32 akan langsung beradaptasi dengan perubahan array `devices[]` ini:
1. Membuka topik MQTT baru untuk ID `7`.
2. Melakukan sinkronisasi otomatis (*availability* dan *get_state*) ke react native untuk relay ke-7.
3. Mengaplikasikan jadwal (timer lokal NVS) secara mandiri untuk alat baru tanpa mengganggu alat lama.

## Catatan
Aplikasi hanya akan memberikan notifikasi dan UI memudar ("OFFLINE") pada spesifik perangkat yang koneksi MQTT-nya terputus/offline dari Broker Utama HiveMQ. Jika status keseluruhan ESP32 offline, maka seluruh Card di aplikasi akan berwarna abu-abu redup untuk menghindari eksekusi perintah yang tidak dikirim.
