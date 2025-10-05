import { useState, useEffect } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import "./styles.css";
import { Link } from "react-router-dom";

// Statistical helpers
const average = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const stdDev = (arr) => {
    if (!arr.length) return null;
    const m = average(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
};
const percentile = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

const weathercodeMap = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Drizzle: Light",
    53: "Drizzle: Moderate",
    55: "Drizzle: Dense",
    56: "Freezing Drizzle: Light",
    57: "Freezing Drizzle: Dense",
    61: "Rain: Slight",
    63: "Rain: Moderate",
    65: "Rain: Heavy",
    66: "Freezing Rain: Light",
    67: "Freezing Rain: Heavy",
    71: "Snow fall: Slight",
    73: "Snow fall: Moderate",
    75: "Snow fall: Heavy",
    77: "Snow grains",
    80: "Rain showers: Slight",
    81: "Rain showers: Moderate",
    82: "Rain showers: Violent",
    85: "Snow showers: Slight",
    86: "Snow showers: Heavy",
    95: "Thunderstorm: Slight/Moderate",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
};

// Function: probabilistic climatology
const fetchClimatologyProbabilities = async (lat, lng, date, hour) => {
    if (!date || hour === undefined || lat == null || lng == null) return null;

    const target = new Date(date + "T00:00:00Z"); // considera data em UTC para extrair mês/dia
    const currentYear = new Date().getUTCFullYear();
    const anos = Array.from({ length: 10 }, (_, i) => currentYear - 1 - i); // últimos 10 anos

    const samples = {
        t2m: [],
        rh2m: [],
        prectot: [],
        ws10m: [],
        appTemp: [],
        snowfall: [],
        weatherCodes: []
    };

    for (let ano of anos) {
        // create historical date with same month/day in year 'year'
        const hist = new Date(Date.UTC(ano, target.getUTCMonth(), target.getUTCDate())); // UTC
        const yyyy = hist.getUTCFullYear();
        const mm = String(hist.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(hist.getUTCDate()).padStart(2, "0");
        const startDateStr = `${yyyy}-${mm}-${dd}`;
        const endDateStr = startDateStr;

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}`
            + `&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,apparent_temperature,snowfall,weathercode`
            + `&start_date=${startDateStr}&end_date=${endDateStr}&timezone=UTC`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!data?.hourly || !Array.isArray(data.hourly.time)) continue;

            // find index of desired time (time in UTC)
            const idx = data.hourly.time.findIndex(t => new Date(t).getUTCHours() === parseInt(hour));
            if (idx === -1) continue;

            const getVal = (arr) => (Array.isArray(arr) ? arr[idx] : null);

            const t2m = getVal(data.hourly.temperature_2m);
            const rh2m = getVal(data.hourly.relative_humidity_2m);
            const prectot = getVal(data.hourly.precipitation);
            const ws10m = getVal(data.hourly.wind_speed_10m);
            const appTemp = getVal(data.hourly.apparent_temperature);
            const snowfall = getVal(data.hourly.snowfall);
            const wcode = getVal(data.hourly.weathercode);

            if (t2m !== null && t2m !== undefined) samples.t2m.push(t2m);
            if (rh2m !== null && rh2m !== undefined) samples.rh2m.push(rh2m);
            if (prectot !== null && prectot !== undefined) samples.prectot.push(prectot);
            if (ws10m !== null && ws10m !== undefined) samples.ws10m.push(ws10m);
            if (appTemp !== null && appTemp !== undefined) samples.appTemp.push(appTemp);
            if (snowfall !== null && snowfall !== undefined) samples.snowfall.push(snowfall);
            if (wcode !== null && wcode !== undefined) samples.weatherCodes.push(wcode);
        } catch (err) {
            console.error("Erro ao buscar histórico para ano", ano, err);
            continue;
        }
    }

    const totalSamples = samples.weatherCodes.length || Math.max(
        samples.t2m.length,
        samples.rh2m.length,
        samples.prectot.length,
        samples.ws10m.length,
        samples.appTemp.length,
        samples.snowfall.length
    );

    // statistics by variable
    const stats = {
        t2m: {
            mean: average(samples.t2m),
            std: stdDev(samples.t2m),
            q1: percentile(samples.t2m, 0.25),
            q3: percentile(samples.t2m, 0.75),
            min: Math.min(...(samples.t2m.length ? samples.t2m : [NaN])),
            max: Math.max(...(samples.t2m.length ? samples.t2m : [NaN])),
            n: samples.t2m.length
        },
        rh2m: {
            mean: average(samples.rh2m),
            std: stdDev(samples.rh2m),
            q1: percentile(samples.rh2m, 0.25),
            q3: percentile(samples.rh2m, 0.75),
            min: Math.min(...(samples.rh2m.length ? samples.rh2m : [NaN])),
            max: Math.max(...(samples.rh2m.length ? samples.rh2m : [NaN])),
            n: samples.rh2m.length
        },
        prectot: {
            mean: average(samples.prectot),
            std: stdDev(samples.prectot),
            probPrecipitation: (samples.prectot.filter(v => v > 0).length) / (samples.prectot.length || totalSamples || 1),
            q1: percentile(samples.prectot, 0.25),
            q3: percentile(samples.prectot, 0.75),
            n: samples.prectot.length
        },
        ws10m: {
            mean: average(samples.ws10m),
            std: stdDev(samples.ws10m),
            n: samples.ws10m.length
        },
        apparentTemperature: {
            mean: average(samples.appTemp),
            std: stdDev(samples.appTemp),
            n: samples.appTemp.length
        },
        snowfall: {
            mean: average(samples.snowfall),
            std: stdDev(samples.snowfall),
            probSnow: (samples.snowfall.filter(v => v > 0).length) / (samples.snowfall.length || totalSamples || 1),
            n: samples.snowfall.length
        },
        weather: {
            counts: (() => {
                const c = {};
                for (let code of samples.weatherCodes) c[code] = (c[code] || 0) + 1;
                return c;
            })(),
            probabilities: (() => {
                const counts = {};
                for (let code of samples.weatherCodes) counts[code] = (counts[code] || 0) + 1;
                const entries = Object.entries(counts).map(([code, count]) => {
                    return [weathercodeMap[code] || code, count / (samples.weatherCodes.length || 1)];
                });
                return Object.fromEntries(entries);
            })(),
            n: samples.weatherCodes.length
        },
        samplesCount: totalSamples
    };

    return { type: "climatology", stats, samples }; // samples podem ajudar debugging
};

// Function: fetches historical hourly data for exact date (when available)
const fetchSpecificDateData = async (lat, lng, date, hour) => {
    if (!date || hour === undefined) return null;
    try {
        const response = await fetch(
            `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,apparent_temperature,weathercode,snowfall&start_date=${date}&end_date=${date}&timezone=UTC`
        );
        const data = await response.json();

        if (!data?.hourly) {
            console.warn("No hourly data available for this date/location.");
            return null;
        }

        const hourIndex = data.hourly.time.findIndex(t => new Date(t).getUTCHours() === parseInt(hour));
        if (hourIndex === -1) return null;

        return {
            type: "historical",
            t2m: data.hourly.temperature_2m[hourIndex],
            rh2m: data.hourly.relative_humidity_2m[hourIndex],
            prectot: data.hourly.precipitation[hourIndex],
            ws10m: data.hourly.wind_speed_10m[hourIndex],
            apparentTemperature: data.hourly.apparent_temperature[hourIndex],
            snowfall: data.hourly.snowfall[hourIndex],
            weatherCode: data.hourly.weathercode[hourIndex],
            weather: weathercodeMap[data.hourly.weathercode[hourIndex]] ?? "Unknown",
        };
    } catch (err) {
        console.error("Error fetching specific date data:", err);
        return null;
    }
};

function Weather() {
    const [pages, setPages] = useState([]);
    const [flippedPages, setFlippedPages] = useState([]);
    const [flippingIndex, setFlippingIndex] = useState(null);
    const [loadingPages, setLoadingPages] = useState(true);
    const [loadingStage, setLoadingStage] = useState("locals");

    // Helper function: save to localStorage
    const savePagesToStorage = (updatedPages) => {
        const minimalData = updatedPages.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            startDate: p.startDate,
            endDate: p.endDate,
            specificDateInput: p.specificDateInput,
            specificHourInput: p.specificHourInput,
        }));
        localStorage.setItem("savedWeatherPages", JSON.stringify(minimalData));
    };

    // Function: get location name
    const fetchPlaceName = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
            );
            const data = await res.json();
            return data.display_name ?? "N/A";
        } catch (err) {
            console.error("Error fetching display_name:", err);
            return "Error";
        }
    };

    // Function: fetch data from date range (NASA POWER)
    const fetchWeatherForDateRange = async (lat, lng, startDate, endDate) => {
        if (!startDate || !endDate) return [];

        const [startYear, startMonth, startDay] = startDate.split("-");
        const [endYear, endMonth, endDay] = endDate.split("-");

        const startDateFormatted = `${startYear}${startMonth}${startDay}`;
        const endDateFormatted = `${endYear}${endMonth}${endDay}`;

        try {
            const res = await fetch(
                `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,RH2M,PRECTOT,WS10M,ALLSKY_SFC_SW_DWN,T2MWET&community=AG&longitude=${lng}&latitude=${lat}&start=${startDateFormatted}&end=${endDateFormatted}&format=JSON`
            );
            const data = await res.json();

            if (!data?.properties?.parameter?.T2M) return [];

            return Object.keys(data.properties.parameter.T2M).map((dateKey) => {
                const year = dateKey.slice(0, 4);
                const month = dateKey.slice(4, 6);
                const day = dateKey.slice(6, 8);
                return {
                    year: `${month}/${day}/${year}`,
                    t2m:
                        data?.properties?.parameter?.T2M?.[dateKey] !== -999
                            ? data?.properties?.parameter?.T2M?.[dateKey]
                            : null,
                    rh2m:
                        data?.properties?.parameter?.RH2M?.[dateKey] !== -999
                            ? data?.properties?.parameter?.RH2M?.[dateKey]
                            : null,
                    prectot:
                        data?.properties?.parameter?.PRECTOTCORR?.[dateKey] !== -999
                            ? data?.properties?.parameter?.PRECTOTCORR?.[dateKey]
                            : null,
                    ws10m:
                        data?.properties?.parameter?.WS10M?.[dateKey] !== -999
                            ? data?.properties?.parameter?.WS10M?.[dateKey]
                            : null,
                    solarRadiation:
                        data?.properties?.parameter?.ALLSKY_SFC_SW_DWN?.[dateKey] !== -999
                            ? data?.properties?.parameter?.ALLSKY_SFC_SW_DWN?.[dateKey]
                            : null,
                    heatIndex:
                        data?.properties?.parameter?.T2MWET?.[dateKey] !== -999
                            ? data?.properties?.parameter?.T2MWET?.[dateKey]
                            : null,
                };
            });
        } catch (err) {
            console.error("Error fetching data:", err);
            return [];
        }
    };

    // Initial loading
    useEffect(() => {
        const loadPages = async () => {
            const savedShapes = JSON.parse(localStorage.getItem("drawnShapes")) || [];
            const savedInputs =
                JSON.parse(localStorage.getItem("savedWeatherPages")) || [];

            setLoadingStage("locals");

            const pagesWithData = await Promise.all(
                savedShapes.map(async (geojson) => {
                    const coords = geojson.geometry?.coordinates;
                    if (!coords) return null;
                    const [lng, lat] = coords;

                    const placeName = await fetchPlaceName(lat, lng);

                    setLoadingStage("data");

                    const existing = savedInputs.find((p) => p.lat === lat && p.lng === lng);

                    const startDate = existing?.startDate || "";
                    const endDate = existing?.endDate || "";
                    const specificDateInput = existing?.specificDateInput || "";
                    const specificHourInput = existing?.specificHourInput || "";

                    const data =
                        startDate && endDate
                            ? await fetchWeatherForDateRange(lat, lng, startDate, endDate)
                            : null;

                    // if specificDateInput exists, decides if it is future -> calls climatology, otherwise historical
                    let specificDateData = null;
                    if (specificDateInput && specificHourInput != null) {
                        const selected = new Date(specificDateInput + "T00:00:00Z");
                        const today = new Date();
                        const isFuture = selected.getTime() > today.getTime();
                        if (isFuture) {
                            specificDateData = await fetchClimatologyProbabilities(lat, lng, specificDateInput, specificHourInput);
                        } else {
                            specificDateData = await fetchSpecificDateData(lat, lng, specificDateInput, specificHourInput);
                        }
                    }

                    return {
                        lat,
                        lng,
                        placeName,
                        startDate,
                        endDate,
                        data,
                        loading: false,
                        specificDateInput,
                        specificHourInput,
                        specificDateData,
                        loadingSpecificDate: false,
                    };
                })
            );

            setPages(pagesWithData.filter(Boolean));
            setLoadingPages(false);
        };

        loadPages();
    }, []);

    // Updates localStorage whenever pages change (no heavy data)
    useEffect(() => {
        if (pages.length > 0) savePagesToStorage(pages);
    }, [pages]);

    // Search range
    const handleFetchData = async (index) => {
        const page = pages[index];
        if (!page.startDate || !page.endDate) {
            return;
        }

        setPages((prev) =>
            prev.map((p, i) => (i === index ? { ...p, loading: true } : p))
        );

        const data = await fetchWeatherForDateRange(
            page.lat,
            page.lng,
            page.startDate,
            page.endDate
        );

        setPages((prev) =>
            prev.map((p, i) =>
                i === index ? { ...p, data, loading: false } : p
            )
        );
    };

    // Search for a specific date (historical or climatology if future)
    const handleFetchSpecificDate = async (index) => {
        const page = pages[index];
        if (!page.specificDateInput || page.specificHourInput == null) return;

        setPages((prev) =>
            prev.map((p, i) =>
                i === index ? { ...p, loadingSpecificDate: true } : p
            )
        );

        const selected = new Date(page.specificDateInput + "T00:00:00Z");
        const today = new Date();
        const isFuture = selected.getTime() > today.getTime();

        let specificDateData = null;
        if (isFuture) {
            // calls the function probabilistic climatology
            specificDateData = await fetchClimatologyProbabilities(
                page.lat,
                page.lng,
                page.specificDateInput,
                page.specificHourInput
            );
        } else {
            // search exact history
            specificDateData = await fetchSpecificDateData(
                page.lat,
                page.lng,
                page.specificDateInput,
                page.specificHourInput
            );
        }

        setPages((prev) =>
            prev.map((p, i) =>
                i === index ? { ...p, specificDateData, loadingSpecificDate: false } : p
            )
        );
    };

    // Turn page
    const handlePageFlip = (index) => {
        const isFlipped = flippedPages.includes(index);
        if (isFlipped) {
            setFlippedPages(flippedPages.filter((i) => i !== index));
        } else {
            setFlippingIndex(index);
            setFlippedPages([...flippedPages, index]);
            setTimeout(() => setFlippingIndex(null), 1000);
        }
    };

    if (loadingPages) {
        return (
            <div className="weather-container">
                <div className="loading-screen">
                    {loadingStage === "locals" && <p>Loading local names...</p>}
                    {loadingStage === "data" && <p>Fetching weather data...</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="weather-container">
            {(pages.length == 0) ? <p className="loading-screen">No <Link to="/map" className="loading-screen">markers</Link> avaliable :/</p> : <div className="book">
                {pages.map((page, index) => {
                    const isFlipped = flippedPages.includes(index);
                    const zIndex =
                        flippingIndex === index
                            ? pages.length + 1
                            : isFlipped
                                ? index
                                : pages.length - index;

                    return (
                        <div
                            key={index}
                            className={`book-page ${isFlipped ? "flipped" : ""}`}
                            style={{ zIndex }}
                        >
                            {/* FRONT PAGE */}
                            <div className="page-front">
                                <div className="page-header">
                                    <h1>
                                        {page.placeName.slice(0, 50)}
                                        {page.placeName.length > 50 ? "..." : null}
                                    </h1>
                                    <div className="input-section">
                                        <div className="date-range-inputs">
                                            <div className="date-input-group">
                                                <label>Start:</label>
                                                <input
                                                    type="date"
                                                    value={page.startDate}
                                                    onChange={(e) => {
                                                        const updated = [...pages];
                                                        updated[index].startDate = e.target.value;
                                                        setPages(updated);
                                                    }}
                                                />
                                            </div>
                                            <div className="date-input-group">
                                                <label>End:</label>
                                                <input
                                                    type="date"
                                                    value={page.endDate}
                                                    onChange={(e) => {
                                                        const updated = [...pages];
                                                        updated[index].endDate = e.target.value;
                                                        setPages(updated);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => handleFetchData(index)}>
                                            Search Climate History
                                        </button>
                                    </div>
                                </div>

                                <div className="page-content">
                                    {page.loading && <p>Loading data...</p>}

                                    {!page.data && !page.loading && (
                                        <div className="no-data">
                                            <p>
                                                Select start and end dates and click "Search Climate
                                                History" to view weather information for that period.
                                            </p>
                                        </div>
                                    )}

                                    {page.data && page.data.length > 0 && !page.loading && (
                                        <ResponsiveContainer width="90%" height="100%">
                                            <LineChart data={page.data}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="year" />
                                                <YAxis />
                                                <Tooltip isAnimationActive={false} />
                                                <Legend />
                                                <Line
                                                    type="monotone"
                                                    dataKey="t2m"
                                                    name="Temperature (℃)"
                                                    stroke="#0085d1"
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="rh2m"
                                                    name="Humidity (%)"
                                                    stroke="#2ab1ff"
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="prectot"
                                                    name="Precipitation (mm)"
                                                    stroke="#003fd1"
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="ws10m"
                                                    name="Wind Speed (m/s)"
                                                    stroke="#a8bae4"
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="solarRadiation"
                                                    name="Solar Radiation (W/m²)"
                                                    stroke="#a8bae4"
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="heatIndex"
                                                    name="Apparent Temperature (℃)"
                                                    stroke="#a8bae4"
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                                <div className="samples-note">Weather data by <a href="https://power.larc.nasa.gov/">NASA POWER</a></div>

                                <div className="page-footer">
                                    <p>
                                        {index + 1} of {pages.length}
                                    </p>
                                    <div className="navigation-buttons">
                                        <button onClick={() => handlePageFlip(index)}>→</button>
                                    </div>
                                </div>
                            </div>

                            {/* BACK PAGE */}
                            <div className="page-back">
                                <div className="page-header">
                                    <h1>
                                        {page.placeName.slice(0, 50)}
                                        {page.placeName.length > 50 ? "..." : null}
                                    </h1>
                                    <div className="input-section">
                                        <input
                                            type="date"
                                            value={page.specificDateInput}
                                            onChange={(e) => {
                                                const updated = [...pages];
                                                updated[index].specificDateInput = e.target.value;
                                                setPages(updated);
                                            }}
                                            placeholder="Select a specific date"
                                        />
                                        <input
                                            type="number"
                                            value={page.specificHourInput}
                                            onChange={(e) => {
                                                const updated = [...pages];
                                                updated[index].specificHourInput = e.target.value;
                                                setPages(updated);
                                            }}
                                            placeholder="Select a hour (0-23)"
                                        />

                                        <button onClick={() => handleFetchSpecificDate(index)}>
                                            Get Weather Data
                                        </button>
                                    </div>
                                </div>

                                <div className="page-content">
                                    {page.loadingSpecificDate && <p>Loading weather data...</p>}

                                    {/* If there is historical specificDateData */}
                                    {!page.loadingSpecificDate && page.specificDateData && page.specificDateData.type === "historical" ? (
                                        <div>
                                            <div className="weather-cards">
                                                {page.specificDateData.t2m != null &&
                                                    page.specificDateData.rh2m != null &&
                                                    page.specificDateData.prectot != null &&
                                                    page.specificDateData.ws10m != null ? (
                                                    <>
                                                        <div className="weather-info-title">
                                                            {page.specificDateData.weather}
                                                        </div><br />
                                                        <div className="weather-info">
                                                            <h3 className="labelT">&#9731; Temperature:</h3>
                                                            <p className="label">{page.specificDateData.t2m} ℃</p>
                                                            <p>Degree Celsius</p>
                                                        </div>
                                                        <div className="weather-info">
                                                            <h3 className="labelT">&#9729; Humidity:</h3>
                                                            <p className="label">{page.specificDateData.rh2m} %</p>
                                                            <p>Percent</p>
                                                        </div>
                                                        <div className="weather-info">
                                                            <h3 className="labelT">&#9730; Precipitation:</h3>
                                                            <p className="label">{page.specificDateData.prectot} mm</p>
                                                            <p>Millimeters</p>
                                                        </div>
                                                        <div className="weather-info">
                                                            <h3 className="labelT">&#9992; Wind Speed:</h3>
                                                            <p className="label">{page.specificDateData.ws10m} m/s</p>
                                                            <p>kilometers per hour</p>
                                                        </div>
                                                        <div className="weather-info">
                                                            <h3 className="labelT">&#127777; Apparent Temperature:</h3>
                                                            <p className="label">{page.specificDateData.apparentTemperature} ℃</p>
                                                            <p>Degree Celsius</p>
                                                        </div>
                                                        <div className="weather-info">
                                                            <h3 className="labelT">&#9731; Snowfall:</h3>
                                                            <p className="label">{page.specificDateData.snowfall} mm</p>
                                                            <p>Millimeters</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="weather-info">No data available yet :/</p>
                                                )}
                                            </div>
                                            <div className="footer-container">
                                                <div className="samples-note"><a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a></div>

                                                <p>Download <Link to={`/export/json?lat=${page.lat}&lng=${page.lng}&date=${page.specificDateInput}&hour=${page.specificHourInput}`}>JSON data</Link> here</p>
                                                <p>Download <Link to={`/export/csv?lat=${page.lat}&lng=${page.lng}&date=${page.specificDateInput}&hour=${page.specificHourInput}`}>CSV data</Link> here</p>
                                            </div>
                                        </div>

                                    ) : (!page.loadingSpecificDate && page.specificDateData && page.specificDateData.type === "climatology") ? (
                                        <div className="climatology-container">
                                            <div className="climatology-title">
                                                Estimate based on historical data (last 10 years)
                                            </div>

                                            <div className="climatology-section">
                                                <div className="section-title">Temperature</div>
                                                {page.specificDateData.stats.t2m.mean != null ? (
                                                    <>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Expected (average):</div>
                                                            <div className="stat-value">{page.specificDateData.stats.t2m.mean.toFixed(1)} ℃</div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Typical variation:</div>
                                                            <div className="stat-value">±{page.specificDateData.stats.t2m.std != null ? page.specificDateData.stats.t2m.std.toFixed(1) : "N/A"} ℃</div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Common range (25%–75%):</div>
                                                            <div className="stat-value">{page.specificDateData.stats.t2m.q1.toFixed(1) ?? "N/A"} ℃ – {page.specificDateData.stats.t2m.q3.toFixed(1) ?? "N/A"} ℃</div>
                                                        </div>
                                                        <div className="stat-explain">
                                                            What this means: historically, for the same date and time, the temperature usually stays close to the reported average — the variation shows how different it can be.
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="stat-explain">There are not enough historical samples for temperature.</div>
                                                )}
                                            </div>

                                            <div className="climatology-section">
                                                <div className="section-title">Humidity</div>
                                                {page.specificDateData.stats.rh2m.mean != null ? (
                                                    <>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Expected (average):</div>
                                                            <div className="stat-value">{page.specificDateData.stats.rh2m.mean.toFixed(0)} %</div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Typical variation:</div>
                                                            <div className="stat-value">±{page.specificDateData.stats.rh2m.std != null ? page.specificDateData.stats.rh2m.std.toFixed(0) : "N/A"} %</div>
                                                        </div>
                                                        <div className="stat-explain">Humidity indicates how muggy it feels and the likelihood of fog/drizzle.</div>
                                                    </>
                                                ) : (
                                                    <div className="stat-explain">There are not enough historical samples for humidity.</div>
                                                )}
                                            </div>

                                            <div className="climatology-section">
                                                <div className="section-title">Rain</div>
                                                {page.specificDateData.stats.prectot.n > 0 ? (
                                                    <>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Historical chance of rain:</div>
                                                            <div className="stat-value">{(page.specificDateData.stats.prectot.probPrecipitation * 100).toFixed(0)}%</div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Average when it occurs:</div>
                                                            <div className="stat-value">{page.specificDateData.stats.prectot.mean != null ? page.specificDateData.stats.prectot.mean.toFixed(1) + " mm" : "N/A"}</div>
                                                        </div>
                                                        <div className="stat-explain">Simple interpretation: e.g., 30% = in 3 out of 10 years there was rain at that same date/time.</div>
                                                    </>
                                                ) : (
                                                    <div className="stat-explain">There are not enough historical samples for precipitation.</div>
                                                )}
                                            </div>

                                            <div className="climatology-section">
                                                <div className="section-title">Snow</div>
                                                {page.specificDateData.stats.snowfall.n > 0 ? (
                                                    <>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Historical chance of snow:</div>
                                                            <div className="stat-value">{(page.specificDateData.stats.snowfall.probSnow * 100).toFixed(0)}%</div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Average when it occurs:</div>
                                                            <div className="stat-value">{page.specificDateData.stats.snowfall.mean != null ? page.specificDateData.stats.snowfall.mean.toFixed(1) + " mm (water equivalent)" : "N/A"}</div>
                                                        </div>
                                                        <div className="stat-explain">Note: the unit is mm of water equivalent; 1 mm ≈ ~1 cm of fluffy snow, depending on snow type.</div>
                                                    </>
                                                ) : (
                                                    <div className="stat-explain">There are not enough historical samples for snow.</div>
                                                )}
                                            </div>

                                            <div className="climatology-section">
                                                <div className="section-title">Wind</div>
                                                {page.specificDateData.stats.ws10m.n > 0 ? (
                                                    <>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Average speed:</div>
                                                            <div className="stat-value">{page.specificDateData.stats.ws10m.mean.toFixed(1)} m/s</div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <div className="stat-key">Typical variation:</div>
                                                            <div className="stat-value">±{page.specificDateData.stats.ws10m.std != null ? page.specificDateData.stats.ws10m.std.toFixed(1) : "N/A"} m/s</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="stat-explain">There are not enough historical samples for wind.</div>
                                                )}
                                            </div>

                                            <div className="climatology-section">
                                                <div className="section-title">Weather condition (categories)</div>
                                                {page.specificDateData.stats.weather.probabilities && Object.keys(page.specificDateData.stats.weather.probabilities).length > 0 ? (
                                                    <>
                                                        <ul className="prob-list">
                                                            {Object.entries(page.specificDateData.stats.weather.probabilities).map(([desc, p]) => (
                                                                <li key={desc}>{desc}: {(p * 100).toFixed(0)}%</li>
                                                            ))}
                                                        </ul>
                                                        <div className="stat-explain">Example: "Clear sky: 60%" means that in 6 out of 10 years, at that date/time, the sky was clear.</div>
                                                    </>
                                                ) : (
                                                    <div className="stat-explain">There are not enough weather codes to form probabilities.</div>
                                                )}
                                            </div>

                                            <div className="footer-container">
                                                <div className="samples-note">Basis of estimates: last {page.specificDateData.stats.samplesCount} samples (one per year, same date/time, last 10 years). <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a></div>

                                                <p>Download <Link to={`/export/json?lat=${page.lat}&lng=${page.lng}&date=${page.specificDateInput}&hour=${page.specificHourInput}`}>JSON data</Link> here</p>
                                                <p>Download <Link to={`/export/csv?lat=${page.lat}&lng=${page.lng}&date=${page.specificDateInput}&hour=${page.specificHourInput}`}>CSV data</Link> here</p>
                                            </div>
                                        </div>


                                    ) : !page.loadingSpecificDate ? (
                                        <div className="no-data">
                                            <p>
                                                Select a date and hour and click "Get Weather Data" to see the weather information.
                                            </p>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="page-footer">
                                    <div className="navigation-buttons">
                                        <button onClick={() => handlePageFlip(index)}>←</button>
                                    </div>
                                </div>
                            </div>


                        </div>
                    );
                })}
            </div>}
        </div>
    );
}

export default Weather;
