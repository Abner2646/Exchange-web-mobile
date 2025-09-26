import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx'
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register.jsx'
import Swap from './pages/Swap.jsx'
import ConfiguracionPerfil from './pages/ConfiguracionPerfil.jsx';
import AuthSuccess from './pages/AuthSuccess';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext';
import './styles/global.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="" element={<Home />} />
                    <Route path="swap" element={<Swap />} />
                    <Route path="profile" element={<ConfiguracionPerfil />} />
                    <Route path="auth-success" element={<AuthSuccess />} />
                </Route>
            </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;