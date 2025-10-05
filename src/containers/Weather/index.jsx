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

function Weather() {
    const [pages, setPages] = useState([]);
    const [flippedPages, setFlippedPages] = useState([]);
    const [flippingIndex, setFlippingIndex] = useState(null);
    const [loadingPages, setLoadingPages] = useState(true);
    const [loadingStage, setLoadingStage] = useState("locals");

    // --- Helper function: save to localStorage ---
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



    // --- Function: get location name ---
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

    // --- Function: fetch data from date range ---
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

    // --- Function: fetch data from a specific date and hour (Open-Meteo) ---
    const fetchSpecificDateData = async (lat, lng, date, hour) => {
        if (!date || hour === undefined) return null;
        try {
            const startDate = date;
            const endDate = date;

            const response = await fetch(
                `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,apparent_temperature,weathercode&start_date=${startDate}&end_date=${endDate}&timezone=UTC`
            );
            const data = await response.json();

            if (!data?.hourly) {
                console.warn("No hourly data available for this date/location.");
                return null;
            }

            const hourIndex = data.hourly.time.findIndex(t => new Date(t).getUTCHours() === parseInt(hour));
            if (hourIndex === -1) return null;

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
            console.log(weathercodeMap[data.hourly.weathercode[hourIndex]]);

            return {
                t2m: data.hourly.temperature_2m[hourIndex],
                rh2m: data.hourly.relative_humidity_2m[hourIndex],
                prectot: data.hourly.precipitation[hourIndex],
                ws10m: data.hourly.wind_speed_10m[hourIndex],
                apparentTemperature: data.hourly.apparent_temperature[hourIndex],
                weather: weathercodeMap[data.hourly.weathercode[hourIndex]] ?? "Unknown",
            };
        } catch (err) {
            console.error("Error fetching specific date data:", err);
            return null;
        }
    };







    // --- Initial loading ---
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

                    const specificDateData =
                        specificDateInput && specificHourInput
                            ? await fetchSpecificDateData(lat, lng, specificDateInput, specificHourInput)
                            : null;


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

    // --- Updates localStorage whenever pages change (no heavy data) ---
    useEffect(() => {
        if (pages.length > 0) savePagesToStorage(pages);
    }, [pages]);

    // --- Search range ---
    const handleFetchData = async (index) => {
        const page = pages[index];
        if (!page.startDate || !page.endDate) {
            alert("Select start and end dates.");
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

    // --- Search for a specific date ---
    const handleFetchSpecificDate = async (index) => {
        const page = pages[index];
        if (!page.specificDateInput || page.specificHourInput == null) return;

        setPages((prev) =>
            prev.map((p, i) =>
                i === index ? { ...p, loadingSpecificDate: true } : p
            )
        );

        const specificDateData = await fetchSpecificDateData(
            page.lat,
            page.lng,
            page.specificDateInput,
            page.specificHourInput
        );

        setPages((prev) =>
            prev.map((p, i) =>
                i === index ? { ...p, specificDateData, loadingSpecificDate: false } : p
            )
        );
    };


    // --- Turn page ---
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
                                                    name="Heat Index (℃)"
                                                    stroke="#a8bae4"
                                                    dot={false}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

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

                                    {!page.loadingSpecificDate && page.specificDateData ? (
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
                                                        <p>Degree Celsius</p>
                                                    </div>
                                                    <div className="weather-info">
                                                        <h3 className="labelT">&#9730; Precipitation:</h3>
                                                        <p className="label">{page.specificDateData.prectot} mm</p>
                                                        <p>Degree Celsius</p>
                                                    </div>
                                                    <div className="weather-info">
                                                        <h3 className="labelT">&#9992; Wind Speed:</h3>
                                                        <p className="label">{page.specificDateData.ws10m} m/s</p>
                                                        <p>Degree Celsius</p>
                                                    </div>
                                                    <div className="weather-info">
                                                        <h3 className="labelT">&#127777; Apparent Temperature:</h3>
                                                        <p className="label">{page.specificDateData.apparentTemperature} ℃</p>
                                                        <p>Degree Celsius</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="weather-info">No data available yet :/</p>
                                            )}
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