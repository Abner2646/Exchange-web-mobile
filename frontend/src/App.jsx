// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout.jsx';
import HomePage from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register.jsx';
import AuthSuccess from './pages/AuthSuccess';
import Activos from './pages/Activos.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import Depositos from './pages/Depositos.jsx';
//import Swap from './pages/Swap.jsx';
//import ConfiguracionPerfil from './pages/ConfiguracionPerfil.jsx';
//import Withdrawal from './pages/Retiros.jsx';
//import P2PMarketplace from './pages/P2PMarketplace.jsx';
//import P2PTransaction from './pages/P2PTransaction.jsx';
//import CrearOfertaP2P from './pages/CrearOfertaP2P.jsx';
//import MisOfertas from './pages/P2PMisOfertas.jsx';
import Transferencia from './pages/Transferencia.jsx';
//import Notificaciones from './pages/Notificaciones.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext';
import './styles/global.css';

// Crear QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" />
            <Routes>
              <Route path="/" element={<Layout />}>
              <Route path="/" element={<HomePage />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="auth-success" element={<AuthSuccess />} />
                <Route path="super_admin" element={<SuperAdmin />} />
                <Route path="activos" element={<Activos />} />
                <Route path="depositos" element={<Depositos />} />
                <Route path="transferir" element={<Transferencia />} />
                {/*
                <Route path="swap" element={<Swap />} />
                <Route path="perfil" element={<ConfiguracionPerfil />} />
                <Route path="retiros" element={<Withdrawal />} />
                <Route path="p2p" element={<P2PMarketplace />} />
                <Route path="p2p/transaction/:id" element={<P2PTransaction />} />
                <Route path="p2p/crearOferta" element={<CrearOfertaP2P />} />
                <Route path="p2p/misOfertas" element={<MisOfertas />} />
                <Route path="notificaciones" element={<Notificaciones />} />
                */}
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;