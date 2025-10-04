import "./styles.css";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();
    return(
        <div className="home">
            <img src="../../../public/icon-transparent.png" alt="icon" />
            <button onClick={() => navigate("/map")}>Start</button>
        </div>
    )
}

export default Home