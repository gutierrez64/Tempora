import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import "./styles.css";

function Map() {
    return (
        <div className="map-container">
            <div className="map-tilt">

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

                    <FeatureGroup>
                        <EditControl
                            position="bottomleft"
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