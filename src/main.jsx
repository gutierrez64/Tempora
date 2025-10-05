import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './containers/Home';
import Map from './containers/Map';
import Weather from './containers/Weather';
import ExportJSONWeatherData from './services/ExportJSONWeatherData';
import ExportCSVWeatherData from './services/ExportCSVWeatherData';

function AppWrapper() {
  const location = useLocation();
  // esconder navbar em '/' e na rota de exportação (pois ela não exibe UI)
  const hideNavbarPaths = ['/', '/export'];
  const showNavbar = !hideNavbarPaths.includes(location.pathname);

  return (
    <>
      {showNavbar && <Navbar/>}
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='/map' element={<Map/>}/>
        <Route path='/weather' element={<Weather/>}/>
        <Route path='/export/json' element={<ExportJSONWeatherData/>} />
        <Route path='/export/csv' element={<ExportCSVWeatherData/>} />
      </Routes>
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppWrapper/>
    </BrowserRouter>
  </StrictMode>,
)
