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

function Weather() {
    const [pages, setPages] = useState([]);
    const [flippedPages, setFlippedPages] = useState([]);
    const [flippingIndex, setFlippingIndex] = useState(null);
    const [loadingPages, setLoadingPages] = useState(true);
    const [loadingStage, setLoadingStage] = useState("locals"); // 'locals' | 'data'

    // --- Helper function: save to localStorage ---
    const savePagesToStorage = (updatedPages) => {
        const minimalData = updatedPages.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            startDate: p.startDate,
            endDate: p.endDate,
            specificDateInput: p.specificDateInput,
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
                `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,RH2M,PRECTOT,WS10M&community=AG&longitude=${lng}&latitude=${lat}&start=${startDateFormatted}&end=${endDateFormatted}&format=JSON`
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
                };
            });
        } catch (err) {
            console.error("Error fetching data:", err);
            return [];
        }
    };

    // --- Function: fetch data from a specific date ---
    const fetchSpecificDateData = async (lat, lng, date) => {
        if (!date) return null;
        try {
            const formattedDate = date.replace(/-/g, "");
            const response = await fetch(
                `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,RH2M,PRECTOT,WS10M&community=AG&longitude=${lng}&latitude=${lat}&start=${formattedDate}&end=${formattedDate}&format=JSON`
            );
            const data = await response.json();

            return {
                t2m:
                    data?.properties?.parameter?.T2M?.[formattedDate] !== -999
                        ? data?.properties?.parameter?.T2M?.[formattedDate]
                        : null,
                rh2m:
                    data?.properties?.parameter?.RH2M?.[formattedDate] !== -999
                        ? data?.properties?.parameter?.RH2M?.[formattedDate]
                        : null,
                prectot:
                    data?.properties?.parameter?.PRECTOTCORR?.[formattedDate] !== -999
                        ? data?.properties?.parameter?.PRECTOTCORR?.[formattedDate]
                        : null,
                ws10m:
                    data?.properties?.parameter?.WS10M?.[formattedDate] !== -999
                        ? data?.properties?.parameter?.WS10M?.[formattedDate]
                        : null,
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

            const pagesWithData = await Promise.all(
                savedShapes.map(async (geojson) => {
                    const coords = geojson.geometry?.coordinates;
                    if (!coords) return null;
                    const [lng, lat] = coords;
                    const placeName = await fetchPlaceName(lat, lng);

                    // Checks if there is already data saved for this point
                    const existing = savedInputs.find(
                        (p) => p.lat === lat && p.lng === lng
                    );

                    const startDate = existing?.startDate || "";
                    const endDate = existing?.endDate || "";
                    const specificDateInput = existing?.specificDateInput || "";

                    // Automatically reloads data
                    const data =
                        startDate && endDate
                            ? await fetchWeatherForDateRange(lat, lng, startDate, endDate)
                            : null;

                    const specificDateData = specificDateInput
                        ? await fetchSpecificDateData(lat, lng, specificDateInput)
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
        if (!page.specificDateInput) return;

        setPages((prev) =>
            prev.map((p, i) => (i === index ? { ...p, loadingSpecificDate: true } : p))
        );

        const specificDateData = await fetchSpecificDateData(
            page.lat,
            page.lng,
            page.specificDateInput
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
            <div className="book">
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
                                                    <p className="weather-info">&#9728; Temperature: {page.specificDateData.t2m} ℃</p>
                                                    <p className="weather-info">&#9729; Humidity: {page.specificDateData.rh2m} %</p>
                                                    <p className="weather-info">&#9730; Precipitation: {page.specificDateData.prectot} mm</p>
                                                    <p className="weather-info">&#9992; Wind Speed: {page.specificDateData.ws10m} m/s</p>
                                                </>
                                            ) : (
                                                <p className="weather-info">No data available yet :/</p>
                                            )}
                                        </div>
                                    ) : !page.loadingSpecificDate ? (
                                        <div className="no-data">
                                            <p>
                                                Select a date and click "Get Weather Data" to see the weather information for that specific day.
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
            </div>
        </div>
    );
}

export default Weather;
