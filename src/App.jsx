import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Countdown from './Countdown';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Countdown />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
