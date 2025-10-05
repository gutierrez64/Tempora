import { useRef, useState, useEffect } from "react";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import "./styles.css";
import L, { geoJSON } from "leaflet";

function Map() {
    const [isRotated, setIsRotated] = useState(true);
    const featureGroupRef = useRef();

    const saveDrawings = () => {
        const featureGroup = featureGroupRef.current;
        if (!featureGroup) return;

        const layers = featureGroup.leafletElement || featureGroup;
        const data = [];
        layers.eachLayer(layer => {
            data.push(layer.toGeoJSON());
        });

        localStorage.setItem("drawnShapes", JSON.stringify(data));
    };

    const fetchPlaceName = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`
            );
            const data = await res.json();
            return data.display_name ?? "N/A";
        } catch (err) {
            console.error("Erro ao buscar display_name:", err);
            return "Erro";
        }
    };

    const addPopup = async (layer) => {
        if (!(layer instanceof L.Marker)) return;

        const { lat, lng } = layer.getLatLng();
        const forecastDays = 7;

        layer.bindPopup(
            `<div class="custom-popup">
                <p class="titleP">Loading...</p>
            </div>`,
            { className: "leaflet-custom-popup" }
        );

        layer.openPopup();

        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=celsius&windspeed_unit=kmh&timezone=America%2FNew_York`
            );
            const data = await response.json();

            if (!data || !data.daily) {
                throw new Error("Weather data not found");
            }

            const days = data.daily.time;
            const maxTemps = data.daily.temperature_2m_max;
            const minTemps = data.daily.temperature_2m_min;
            const precip = data.daily.precipitation_sum;
            const windSpeed = data.daily.wind_speed_10m_max;

            let forecastContent = `<div class="custom-popup">
                <h1 class="titleP">Forecast for the next ${forecastDays} days</h1>
                <p class="label">${await fetchPlaceName(lat, lng)}</p>
                <div class="popup-content">`;

            for (let i = 0; i < forecastDays; i++) {
                const date = new Date(days[i]);
                const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                const formattedDate = `${dayOfWeek}, ${days[i]}`;

                forecastContent += `
                <p class="label">${formattedDate}</p><br>
                <div class="item">
                    <p class="labelT">Max Temperature</p>
                    <p>${maxTemps[i]} ℃</p>
                    <p class="label">Degree Celsius</p>
                </div>
                <div class="item">
                    <p class="labelT">Min Temperature</p>
                    <p>${minTemps[i]} ℃</p>
                    <p class="label">Degree Celsius</p>
                </div>
                <div class="item">
                    <p class="labelT">Precipitation</p>
                    <p>${precip[i]} mm</p>
                    <p class="label">Millimeters</p>
                </div>
                <div class="item">
                    <p class="labelT">Max Wind Speed</p>
                    <p>${windSpeed[i]} km/h</p>
                    <p class="label">kilometers per hour</p>
                </div>`;
            }

            forecastContent += `</div><br/><div class="samples-note"><a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a></div></div>`;

            layer.setPopupContent(forecastContent);
        } catch (err) {
            console.error("Error loading weather forecast:", err);
            layer.setPopupContent(`<p>Error loading weather forecast</p>`);
        }
    }

    const handleCreate = (e) => {
        const { layer } = e;
        const featureGroup = featureGroupRef.current;
        if (featureGroup) {
            featureGroup.addLayer(layer);
            addPopup(layer);
            saveDrawings();
        }
    };


    const handleEdit = (e) => {
        const layers = e.layers;
        layers.eachLayer(layer => addPopup(layer));
        saveDrawings();
    };

    const handleDelete = (e) => {
        saveDrawings();
    };

    const loadDrawings = async () => {
        const saved = JSON.parse(localStorage.getItem("drawnShapes")) || [];
        const featureGroup = featureGroupRef.current;
        if (!featureGroup) return;

        featureGroup.clearLayers();

        const popupPromises = saved.map(async (geoJSON) => {
            const layer = L.geoJSON(geoJSON).getLayers()[0];
            featureGroup.addLayer(layer);
            await addPopup(layer);
        });

        await Promise.all(popupPromises);
    }

    useEffect(() => {
        setTimeout(loadDrawings, 100);
    }, []);

    return (
        <div className="map-container">
            <div className={`map-tilt ${isRotated ? 'rotated' : ''}`}>

                <MapContainer
                    center={[0, 0]}
                    zoom={2}
                    minZoom={1}
                    maxZoom={18}
                    className="map"
                    maxBounds={[
                        [-90, -180],
                        [90, 180],
                    ]}
                    maxBoundsViscosity={1.0}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <FeatureGroup ref={featureGroupRef}>
                        <EditControl
                            position="bottomleft"
                            onCreated={handleCreate}
                            onEdited={handleEdit}
                            onDeleted={handleDelete}
                            draw={{
                                rectangle: false,
                                polyline: false,
                                polygon: false,
                                circle: false,
                                marker: true,
                                circlemarker: false
                            }}
                        />
                    </FeatureGroup>
                </MapContainer>

            </div>
        </div>
    );
}

export default Map