import "./styles.css";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();
    return (
        <div className="home">
            <img src="../../../public/icon-transparent.png" alt="icon" />
            <button onClick={() => navigate("/map")}>Start</button>
            <div className="attribution">
                <p>
                    Weather data by <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0) and <a href="https://power.larc.nasa.gov/">NASA POWER</a> ·
                    Geocoding: <a href="https://www.openstreetmap.org/">OpenStreetMap</a> (ODbL)
                </p>
            </div>

        </div>
    )
}

export default Home