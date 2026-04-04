# Smart Relay

Smart Relay adalah aplikasi Expo/React Native untuk mengontrol perangkat relay berbasis ESP32 melalui MQTT, dengan tambahan cuaca BMKG, notifikasi, dan pengaturan perangkat.

## Menjalankan proyek

```bash
npm install
npm run start
```

## Script

- `npm run start` untuk menjalankan Expo dev server
- `npm run android` untuk build/run Android
- `npm run ios` untuk build/run iOS
- `npm run web` untuk menjalankan versi web
- `npm run lint` untuk cek lint

## Struktur penting

- `app/` route utama aplikasi
- `components/smart-home/` komponen UI fitur smart home
- `contexts/` state global bahasa dan koneksi MQTT
- `hooks/` hook cuaca, notifikasi, dan utilitas perangkat
- `esp32/` sketch ESP32 dan catatan integrasi
