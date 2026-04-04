import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { bmkgToInfo, getAdm4ByDistrict } from './bmkg-utils';

const debugWeather = (...args: any[]) => {
    if (__DEV__) {
        console.log(...args);
    }
};

// ── IP geolocation (web fallback, no permission needed) ───────────────────────
async function getCoordsByIP(): Promise<{ lat: number; lon: number; city: string }> {
    try {
        const res = await fetch('https://api.ipapi.is/?fields=latitude,longitude,city');
        if (!res.ok) throw new Error('ipapi failed');
        const j = await res.json();
        return { lat: j.latitude ?? -6.2088, lon: j.longitude ?? 106.8456, city: j.city ?? 'Jakarta' };
    } catch {
        return { lat: -6.2088, lon: 106.8456, city: 'Jakarta' };
    }
}

export interface WeatherInfo {
    description: string;
    icon: string; // Ionicons name
}

// ─── State types ──────────────────────────────────────────────────────────────
export interface WeatherData {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    info: WeatherInfo;
    city: string;
    loading: boolean;
    error: string | null;
}

const DEFAULT_STATE: WeatherData = {
    temperature: 20,
    feelsLike: 18,
    humidity: 60,
    windSpeed: 5,
    weatherCode: 1,
    info: { description: 'Partly cloudy', icon: 'partly-sunny' },
    city: 'My Location',
    loading: true,
    error: null,
};

async function fetchBMKGWeather(lat: number, lon: number, district: string, cityFallback: string | null, cancelled: boolean, setData: React.Dispatch<React.SetStateAction<WeatherData>>) {
    try {
        // Map the district/city to BMKG ADM4 code
        const adm4Code = getAdm4ByDistrict(district, cityFallback);

        const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4Code}`;
        debugWeather(`Weather: Mapping area "${district || cityFallback}" to ADM4 code: ${adm4Code}`);
        debugWeather(`Weather: Fetching BMKG data from: ${url}`);

        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Weather: BMKG API responded with status ${res.status}`);
            throw new Error(`BMKG error ${res.status}`);
        }
        const json = await res.json();
        debugWeather(`Weather: BMKG API response received for ${district}`);

        if (!json.data || json.data.length === 0) {
            console.warn(`Weather: No BMKG data returned for ADM4:${adm4Code}`);
            throw new Error('No BMKG data found');
        }

        const locationData = json.data[0];
        if (!locationData.cuaca || locationData.cuaca.length === 0) throw new Error('No forecast data');

        // Pick the first forecast which is usually the current/upcoming hour.
        const currentForecast = locationData.cuaca[0][0];

        const temperature = Math.round(parseFloat(currentForecast.t));
        const humidity = Math.round(parseFloat(currentForecast.hu));
        const feelsLike = temperature + 2;
        const windSpeed = Math.round(parseFloat(currentForecast.ws || "0"));
        const info = bmkgToInfo(currentForecast.weather_desc_en);

        if (!cancelled) {
            // BMKG locations returns the actual matched name instead of relying strictly on device geocode
            let bmkgLocationName = locationData.lokasi?.desa || locationData.lokasi?.kecamatan || locationData.lokasi?.kotkab;
            if (bmkgLocationName) bmkgLocationName = bmkgLocationName.replace(/Kota |Kab\. |Kabupaten /gi, '');

            setData({
                temperature,
                feelsLike,
                humidity,
                windSpeed,
                weatherCode: 0,
                info,
                city: bmkgLocationName || locationData.lokasi?.nama || district,
                loading: false,
                error: null,
            });
        }
    } catch (e: any) {
        if (!cancelled) {
            setData((prev) => ({ ...prev, loading: false, error: e.message }));
        }
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWeather(customCity?: string): WeatherData {
    const [data, setData] = useState<WeatherData>(DEFAULT_STATE);

    useEffect(() => {
        let cancelled = false;

        async function fetchWeather() {
            try {
                if (Platform.OS === 'web') {
                    debugWeather('Weather: Using IP for geolocation (Web)');
                    const { lat, lon, city } = await getCoordsByIP();
                    await fetchBMKGWeather(lat, lon, customCity || city, city, cancelled, setData);
                    return;
                }

                debugWeather('Weather: Requesting location permissions...');
                const { status } = await Location.requestForegroundPermissionsAsync();

                if (status !== 'granted') {
                    console.warn('Weather: Location permission denied. Falling back to IP.');
                    const { lat, lon, city } = await getCoordsByIP();
                    await fetchBMKGWeather(lat, lon, customCity || city, city, cancelled, setData);
                    return;
                }

                debugWeather('Weather: Fetching current position...');
                // Use a timeout to prevent hanging
                const pos = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Location timeout')), 10000))
                ]);

                if (!pos) throw new Error('Could not get position');

                const { latitude, longitude } = pos.coords;
                debugWeather(`Weather: Position found at ${latitude}, ${longitude}`);

                let city = customCity || 'My Location';
                let districtForBMKG: string | null = null;

                if (!customCity) {
                    try {
                        debugWeather('Weather: Reverse geocoding for coords:', latitude, longitude);
                        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                        debugWeather('Weather: Geocode result:', JSON.stringify(geo[0]));
                        if (geo.length > 0) {
                            city = geo[0].city ?? geo[0].district ?? geo[0].region ?? 'My Location';
                            districtForBMKG = geo[0].district;
                            debugWeather(`Weather: Best match city="${city}", district="${districtForBMKG}"`);
                        }
                    } catch (err) {
                        console.warn('Weather: Reverse geocode failed', err);
                    }
                }

                await fetchBMKGWeather(latitude, longitude, districtForBMKG || city, city, cancelled, setData);
            } catch (e: any) {
                console.error('Weather: Hook error -', e.message);
                if (!cancelled) {
                    setData((prev) => ({ ...prev, loading: false, error: e.message }));
                }
            }
        }

        fetchWeather();
        return () => { cancelled = true; };
    }, [customCity]);

    return data;
}

