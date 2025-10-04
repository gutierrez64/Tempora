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

  const fetchWeatherForDateRange = async (lat, lng, startDate, endDate) => {
    const [startYear, startMonth, startDay] = startDate.split("-");
    const [endYear, endMonth, endDay] = endDate.split("-");

    const results = [];

    const startDateFormatted = `${startYear}${startMonth}${startDay}`;
    const endDateFormatted = `${endYear}${endMonth}${endDay}`;

    try {
      const res = await fetch(
        `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,RH2M,PRECTOT,WS10M&community=AG&longitude=${lng}&latitude=${lat}&start=${startDateFormatted}&end=${endDateFormatted}&format=JSON`
      );

      const data = await res.json();

      const daysData = Object.keys(data.properties.parameter.T2M).map((dateKey) => {
        const year = dateKey.slice(0, 4);
        const month = dateKey.slice(4, 6);
        const day = dateKey.slice(6, 8);

        return {
          year: `${month}/${day}/${year}`,
          t2m: (data?.properties?.parameter?.T2M?.[dateKey] && data?.properties?.parameter?.T2M?.[dateKey] != -999) ? data?.properties?.parameter?.T2M?.[dateKey] : null,
          rh2m: (data?.properties?.parameter?.RH2M?.[dateKey] && data?.properties?.parameter?.RH2M?.[dateKey] != -999) ? data?.properties?.parameter?.RH2M?.[dateKey] : null,
          prectot: (data?.properties?.parameter?.PRECTOTCORR?.[dateKey] == -999) ? null : data?.properties?.parameter?.PRECTOTCORR?.[dateKey],
          ws10m: (data?.properties?.parameter?.WS10M?.[dateKey] && data?.properties?.parameter?.WS10M?.[dateKey] != -999) ? data?.properties?.parameter?.WS10M?.[dateKey] : null,
        };
      });

      results.push(...daysData);

    } catch (err) {
      console.error("Error fetching data:", err);
      const totalDays = (new Date(endDate) - new Date(startDate)) / (1000 * 3600 * 24) + 1;
      for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
        const day = currentDate.getDate().toString().padStart(2, "0");

        results.push({
          year: `${month}/${day}/${year}`,
          t2m: null,
          rh2m: null,
          prectot: null,
          ws10m: null,
        });
      }
    }

    return results;
  };

  const fetchSpecificDateData = async (lat, lng, date) => {
    try {
      const formattedDate = date.replace(/-/g, "");

      const response = await fetch(
        `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,RH2M,PRECTOT,WS10M&community=AG&longitude=${lng}&latitude=${lat}&start=${formattedDate}&end=${formattedDate}&format=JSON`
      );

      const data = await response.json();

      return {
        t2m: data?.properties?.parameter?.T2M?.[formattedDate] ?? "N/A",
        rh2m: data?.properties?.parameter?.RH2M?.[formattedDate] ?? "N/A",
        prectot: data?.properties?.parameter?.PRECTOTCORR?.[formattedDate] ?? "N/A",
        ws10m: data?.properties?.parameter?.WS10M?.[formattedDate] ?? "N/A",
        loading: false,
        error: null
      };
    } catch (err) {
      console.error("Error fetching data from a specific date:", err);
      return {
        t2m: "N/A",
        rh2m: "N/A",
        prectot: "N/A",
        ws10m: "N/A",
        loading: false,
        error: "Error loading data"
      };
    }
  };

  useEffect(() => {
    const loadPages = async () => {
      const savedShapes = JSON.parse(localStorage.getItem("drawnShapes")) || [];

      const pagesWithNames = await Promise.all(
        savedShapes.map(async (geojson) => {
          const coords = geojson.geometry?.coordinates;
          if (!coords) return null;
          const [lng, lat] = coords;
          const placeName = await fetchPlaceName(lat, lng);
          return {
            lat,
            lng,
            placeName,
            startDate: "",
            endDate: "",
            data: null,
            loading: false,
            specificDateInput: "",
            specificDateData: null,
            loadingSpecificDate: false
          };
        })
      );

      setPages(pagesWithNames.filter(Boolean));
      setLoadingPages(false);
    };

    loadPages();
  }, []);

  const handleFetchData = async (index) => {
    const page = pages[index];
    if (!page.startDate || !page.endDate) {
      alert("Select start and end dates.");
      return;
    }

    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, loading: true } : p))
    );

    const data = await fetchWeatherForDateRange(page.lat, page.lng, page.startDate, page.endDate);

    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, data, loading: false } : p))
    );
  };

  const handleFetchSpecificDate = async (index) => {
    const page = pages[index];
    if (!page.specificDateInput) return;

    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, loadingSpecificDate: true } : p))
    );

    const specificDateData = await fetchSpecificDateData(page.lat, page.lng, page.specificDateInput);

    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, specificDateData, loadingSpecificDate: false } : p))
    );
  };

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
          <p>Loading locals...</p>
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
                    <button onClick={() => handleFetchData(index)}>Search Climate History</button>
                  </div>
                </div>

                <div className="page-content">
                  {page.loading && <p>Loading data...</p>}

                  {!page.data && !page.loading && (
                    <div className="no-data">
                      <p>Select start and end dates and click "Search Climate History" to view weather information for that period.</p>
                    </div>
                  )}

                  {page.data && page.data.length > 0 && !page.loading && (
                    <>
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
                            stroke="#2ab1ffff"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="prectot"
                            name="Precipitation (mm)"
                            stroke="#003fd1ff"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="ws10m"
                            name="Wind Speed (m/s)"
                            stroke="#a8bae4ff"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>

                    </>
                  )}

                  {page.data && page.data.length === 0 && !page.loading && (
                    <div className="no-data">
                      <p>No data available for the selected date range.</p>
                    </div>
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
                  {page.loadingSpecificDate && (
                    <div className="loading-specific">
                      <p>Loading weather data...</p>
                    </div>
                  )}

                  {page.specificDateData && !page.loadingSpecificDate && (
                    <>
                      <div className="weather-cards">
                        <p className="weather-info">&#9728; Temperature: {page.specificDateData.t2m} ℃</p>
                        <p className="weather-info">&#9729; Humidity: {page.specificDateData.rh2m} %</p>
                        <p className="weather-info">&#9730; Precipitation: {page.specificDateData.prectot} mm</p>
                        <p className="weather-info">&#9992; Wind Speed: {page.specificDateData.ws10m} m/s</p>
                      </div>
                    </>
                  )}

                  {!page.specificDateData && !page.loadingSpecificDate && (
                    <div className="no-data">
                      <p>Select a date and click "Get Weather Data" to see the weather information for that specific day.</p>
                    </div>
                  )}
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