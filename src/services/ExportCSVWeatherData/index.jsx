import { useEffect } from "react";

/**
 * ExportWeatherData (CSV)
 * generates CSV instead of JSON.
 *
 * Note: Returns null (no HTML). The page should be used as the export endpoint.
 */
export default function ExportCSVWeatherData() {
    useEffect(() => {
        (async () => {
            // helpers
            const safeFilename = (s) =>
                (s || "location")
                    .replace(/\s+/g, "_")
                    .replace(/[^a-zA-Z0-9_\-\.]/g, "")
                    .slice(0, 120);

            const average = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
            const stdDev = (arr) => {
                if (!arr || !arr.length) return null;
                const m = average(arr);
                return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
            };
            const percentile = (arr, p) => {
                if (!arr || !arr.length) return null;
                const s = [...arr].sort((a, b) => a - b);
                const idx = (s.length - 1) * p;
                const lo = Math.floor(idx);
                const hi = Math.ceil(idx);
                if (lo === hi) return s[lo];
                return s[lo] + (s[hi] - s[lo]) * (idx - lo);
            };

            const weathercodeMap = {
                0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
                45: "Fog", 48: "Depositing rime fog", 51: "Drizzle: Light", 53: "Drizzle: Moderate", 55: "Drizzle: Dense",
                56: "Freezing Drizzle: Light", 57: "Freezing Drizzle: Dense", 61: "Rain: Slight", 63: "Rain: Moderate",
                65: "Rain: Heavy", 66: "Freezing Rain: Light", 67: "Freezing Rain: Heavy", 71: "Snow fall: Slight",
                73: "Snow fall: Moderate", 75: "Snow fall: Heavy", 77: "Snow grains", 80: "Rain showers: Slight",
                81: "Rain showers: Moderate", 82: "Rain showers: Violent", 85: "Snow showers: Slight", 86: "Snow showers: Heavy",
                95: "Thunderstorm: Slight/Moderate", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
            };

            const flatten = (obj, prefix = "") => {
                const rows = [];
                const isPrimitive = (v) => v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
                if (isPrimitive(obj)) {
                    rows.push([prefix || "value", obj]);
                    return rows;
                }
                if (Array.isArray(obj)) {
                    obj.forEach((item, i) => {
                        const p = `${prefix}[${i}]`;
                        rows.push(...flatten(item, p));
                    });
                    return rows;
                }
                for (const k of Object.keys(obj)) {
                    const val = obj[k];
                    const p = prefix ? `${prefix}.${k}` : k;
                    if (isPrimitive(val)) {
                        rows.push([p, val]);
                    } else {
                        rows.push(...flatten(val, p));
                    }
                }
                return rows;
            };

            const csvEscape = (v) => {
                if (v === null || v === undefined) return "";
                const s = typeof v === "string" ? v : String(v);
                return `"${s.replace(/"/g, '""')}"`;
            };

            // read query params
            const params = new URLSearchParams(window.location.search);
            const lat = params.get("lat");
            const lng = params.get("lng");
            const date = params.get("date"); 
            const hour = params.get("hour");

            if (!lat || !lng || !date || hour == null) {
                console.warn("Missing lat/lng/date/hour in query string. Redirecting to /");
                window.location.href = "/weather";
                return;
            }

            // fetch helpers
            const fetchPlaceName = async (latv, lngv) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(latv)}&lon=${encodeURIComponent(lngv)}&format=json&accept-language=en`
                    );
                    const json = await res.json();
                    return json.display_name ?? null;
                } catch (err) {
                    console.error("Nominatim error:", err);
                    return null;
                }
            };

            const fetchSpecificDateData = async (latv, lngv, dateStr, hourStr) => {
                try {
                    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(latv)}&longitude=${encodeURIComponent(lngv)}&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,apparent_temperature,weathercode,snowfall&start_date=${encodeURIComponent(dateStr)}&end_date=${encodeURIComponent(dateStr)}&timezone=UTC`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (!data?.hourly) return null;
                    const idx = data.hourly.time.findIndex(t => new Date(t).getUTCHours() === parseInt(hourStr, 10));
                    if (idx === -1) return null;
                    const code = data.hourly.weathercode[idx];
                    return {
                        type: "historical",
                        t2m: data.hourly.temperature_2m[idx],
                        rh2m: data.hourly.relative_humidity_2m[idx],
                        prectot: data.hourly.precipitation[idx],
                        ws10m: data.hourly.wind_speed_10m[idx],
                        apparentTemperature: data.hourly.apparent_temperature[idx],
                        snowfall: data.hourly.snowfall[idx],
                        weatherCode: code,
                        weather: weathercodeMap[code] ?? "Unknown",
                        source: { open_meteo_archive: url }
                    };
                } catch (err) {
                    console.error("fetchSpecificDateData error:", err);
                    return null;
                }
            };

            const fetchClimatologyProbabilities = async (latv, lngv, dateStr, hourStr) => {
                try {
                    const target = new Date(dateStr + "T00:00:00Z");
                    const currentYear = new Date().getUTCFullYear();
                    const anos = Array.from({ length: 10 }, (_, i) => currentYear - 1 - i);
                    const samples = { t2m: [], rh2m: [], prectot: [], ws10m: [], appTemp: [], snowfall: [], weatherCodes: [] };

                    for (let ano of anos) {
                        const hist = new Date(Date.UTC(ano, target.getUTCMonth(), target.getUTCDate()));
                        const yyyy = hist.getUTCFullYear();
                        const mm = String(hist.getUTCMonth() + 1).padStart(2, "0");
                        const dd = String(hist.getUTCDate()).padStart(2, "0");
                        const startDateStr = `${yyyy}-${mm}-${dd}`;
                        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(latv)}&longitude=${encodeURIComponent(lngv)}&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,apparent_temperature,snowfall,weathercode&start_date=${startDateStr}&end_date=${startDateStr}&timezone=UTC`;
                        try {
                            const res = await fetch(url);
                            const data = await res.json();
                            if (!data?.hourly || !Array.isArray(data.hourly.time)) continue;
                            const idx = data.hourly.time.findIndex(t => new Date(t).getUTCHours() === parseInt(hourStr, 10));
                            if (idx === -1) continue;
                            const getVal = (arr) => (Array.isArray(arr) ? arr[idx] : null);
                            const t2m = getVal(data.hourly.temperature_2m);
                            const rh2m = getVal(data.hourly.relative_humidity_2m);
                            const prectot = getVal(data.hourly.precipitation);
                            const ws10m = getVal(data.hourly.wind_speed_10m);
                            const appTemp = getVal(data.hourly.apparent_temperature);
                            const snowfall = getVal(data.hourly.snowfall);
                            const wcode = getVal(data.hourly.weathercode);
                            if (t2m !== null) samples.t2m.push(t2m);
                            if (rh2m !== null) samples.rh2m.push(rh2m);
                            if (prectot !== null) samples.prectot.push(prectot);
                            if (ws10m !== null) samples.ws10m.push(ws10m);
                            if (appTemp !== null) samples.appTemp.push(appTemp);
                            if (snowfall !== null) samples.snowfall.push(snowfall);
                            if (wcode !== null) samples.weatherCodes.push(wcode);
                        } catch (err) { console.warn("Year fetch failed:", ano, err); continue; }
                    }

                    const totalSamples = samples.weatherCodes.length || Math.max(
                        samples.t2m.length, samples.rh2m.length, samples.prectot.length,
                        samples.ws10m.length, samples.appTemp.length, samples.snowfall.length
                    );

                    const counts = {};
                    for (let code of samples.weatherCodes) counts[code] = (counts[code] || 0) + 1;
                    const weatherProbabilities = Object.fromEntries(
                        Object.entries(counts).map(([code, cnt]) => [weathercodeMap[code] ?? code, cnt / (samples.weatherCodes.length || 1)])
                    );

                    const stats = {
                        t2m: { mean: average(samples.t2m), std: stdDev(samples.t2m), q1: percentile(samples.t2m, 0.25), q3: percentile(samples.t2m, 0.75), min: samples.t2m.length ? Math.min(...samples.t2m) : null, max: samples.t2m.length ? Math.max(...samples.t2m) : null, n: samples.t2m.length },
                        rh2m: { mean: average(samples.rh2m), std: stdDev(samples.rh2m), q1: percentile(samples.rh2m, 0.25), q3: percentile(samples.rh2m, 0.75), min: samples.rh2m.length ? Math.min(...samples.rh2m) : null, max: samples.rh2m.length ? Math.max(...samples.rh2m) : null, n: samples.rh2m.length },
                        prectot: { mean: average(samples.prectot), std: stdDev(samples.prectot), probPrecipitation: (samples.prectot.filter(v => v > 0).length) / (samples.prectot.length || totalSamples || 1), n: samples.prectot.length },
                        ws10m: { mean: average(samples.ws10m), std: stdDev(samples.ws10m), n: samples.ws10m.length },
                        apparentTemperature: { mean: average(samples.appTemp), std: stdDev(samples.appTemp), n: samples.appTemp.length },
                        snowfall: { mean: average(samples.snowfall), std: stdDev(samples.snowfall), probSnow: (samples.snowfall.filter(v => v > 0).length) / (samples.snowfall.length || totalSamples || 1), n: samples.snowfall.length },
                        weather: { probabilities: weatherProbabilities, counts, n: samples.weatherCodes.length },
                        samplesCount: totalSamples
                    };

                    return { type: "climatology", stats, samples, source_note: "Open-Meteo archive used per-year (one request per historical year)" };
                } catch (err) {
                    console.error("fetchClimatologyProbabilities error:", err);
                    return null;
                }
            };

            // main workflow
            try {
                const placeName = await fetchPlaceName(lat, lng);
                const selected = new Date(date + "T00:00:00Z");
                const today = new Date();
                const isFuture = selected.getTime() > today.getTime();

                let result = null;
                if (isFuture) result = await fetchClimatologyProbabilities(lat, lng, date, hour);
                else result = await fetchSpecificDateData(lat, lng, date, hour);

                const output = {
                    generatedAt: new Date().toISOString(),
                    request: { lat, lng, date, hour, isFuture },
                    placeName: placeName,
                    result: result,
                    metadata: {
                        units: {
                            temperature_2m: "°C",
                            relative_humidity_2m: "%",
                            precipitation: "mm",
                            wind_speed_10m: "m/s",
                            apparent_temperature: "°C",
                            snowfall: "mm (water equivalent)",
                            weathercode: "WMO-ish codes (mapped to descriptions)"
                        },
                        sources: {
                            nominatim_reverse_geocoding: `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`,
                            open_meteo_archive_docs: "https://open-meteo.com/en/docs",
                            open_meteo_archive_endpoint_example: `https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&hourly=...&start_date=${encodeURIComponent(date)}&end_date=${encodeURIComponent(date)}&timezone=UTC`
                        }
                    }
                };

                const name = safeFilename(`${placeName || lat + "_" + lng}_${date}_${hour}`);
                const filename = `${name}.csv`;

                const pairs = flatten(output, "");
                const lines = ["key,value"];
                for (const [k, v] of pairs) lines.push(`${k},${csvEscape(v)}`);
                const csvContent = lines.join("\n");

                // download only once
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 500);

                setTimeout(() => { window.location.href = "/weather"; }, 600);

            } catch (err) {
                console.error("Export workflow failed:", err);
                setTimeout(() => window.location.href = "/weather", 500);
            }
        })();
    }, []);

    return null;
}
