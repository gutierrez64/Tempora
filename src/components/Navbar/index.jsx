import { Link } from "react-router-dom";
import "./styles.css";

function Navbar() {
  return (
    <nav className="navbar">
      <ul className="nav-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/map" className="map">&#9992;</Link></li>
        <li><Link to="/weather">Weather</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;