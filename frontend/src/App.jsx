import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx'
import HomePage from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register.jsx'
import Swap from './pages/Swap.jsx'
import Activos from './pages/Activos.jsx'
import ConfiguracionPerfil from './pages/ConfiguracionPerfil.jsx';
import Depositos from './pages/Depositos.jsx';
import Withdrawal from './pages/Retiros.jsx';
import P2PMarketplace from './pages/P2PMarketplace.jsx'
import P2PTransaction from './pages/P2PTransaction.jsx'
import CrearOfertaP2P from './pages/CrearOfertaP2P.jsx'
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
                    <Route path="" element={<HomePage />} />
                    <Route path="swap" element={<Swap />} />
                    <Route path="activos" element={<Activos />} />
                    <Route path="perfil" element={<ConfiguracionPerfil />} />
                    <Route path="depositos" element={<Depositos />} />
                    <Route path="retiros" element={<Withdrawal />} />
                    <Route path="p2p" element={<P2PMarketplace />} />
                    <Route path="p2p/transaction/:id" element={<P2PTransaction />} />
                    <Route path="p2p/crearOferta" element={<CrearOfertaP2P />} />
                    <Route path="auth-success" element={<AuthSuccess />} />
                </Route>
            </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;