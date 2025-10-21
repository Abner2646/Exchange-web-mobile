// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import ScrollToTop from './components/common/ScrollToTop.jsx';

// Páginas públicas
import HomePage from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register.jsx';
import AuthSuccess from './pages/AuthSuccess';

// Páginas protegidas
import Activos from './pages/Activos.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import Depositos from './pages/Depositos.jsx';
import Withdrawal from './pages/Retiros.jsx';
import P2PMarketplace from './pages/P2PMarketplace.jsx';
import P2PTransaction from './pages/P2PTransaction.jsx';
import CrearOfertaP2P from './pages/CrearOfertaP2P.jsx';
import MisOfertas from './pages/P2PMisOfertas.jsx';
import Transferencia from './pages/Transferencia.jsx';
import Notificaciones from './pages/Notificaciones.jsx';
import ConfiguracionPerfil from './pages/ConfiguracionPerfil.jsx';
import Swap from './pages/Swap.jsx';

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
           <ScrollToTop />
            <Toaster position="top-right" />
            <Routes>
              <Route path="/" element={<Layout />}>
                {/* ========== RUTAS PÚBLICAS ========== */}
                <Route index element={<HomePage />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="auth-success" element={<AuthSuccess />} />

                {/* ========== RUTAS PROTEGIDAS ========== */}

                {/* Swap */}
                <Route
                  path="swap"
                  element={
                    <ProtectedRoute>
                      <Swap />
                    </ProtectedRoute>
                  }
                />

                {/* P2P */}
                <Route
                  path="p2p"
                  element={
                    <ProtectedRoute>
                      <P2PMarketplace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="p2p/transaction/:id"
                  element={
                    <ProtectedRoute>
                      <P2PTransaction />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="p2p/crearOferta"
                  element={
                    <ProtectedRoute>
                      <CrearOfertaP2P />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="p2p/misOfertas"
                  element={
                    <ProtectedRoute>
                      <MisOfertas />
                    </ProtectedRoute>
                  }
                />

                {/* Wallet */}
                <Route
                  path="activos"
                  element={
                    <ProtectedRoute>
                      <Activos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="depositos"
                  element={
                    <ProtectedRoute>
                      <Depositos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="retiros"
                  element={
                    <ProtectedRoute>
                      <Withdrawal />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="transferir"
                  element={
                    <ProtectedRoute>
                      <Transferencia />
                    </ProtectedRoute>
                  }
                />

                {/* Notificaciones */}
                <Route
                  path="notificaciones"
                  element={
                    <ProtectedRoute>
                      <Notificaciones />
                    </ProtectedRoute>
                  }
                />

                {/* Perfil */}
                <Route
                  path="perfil"
                  element={
                    <ProtectedRoute>
                      <ConfiguracionPerfil />
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin */}
                <Route
                  path="super_admin"
                  element={
                    <ProtectedRoute>
                      <SuperAdmin />
                    </ProtectedRoute>
                  }
                />

                {/* Placeholder - Download App */}
                <Route
                  path="download-app"
                  element={
                    <div className="placeholder-page">
                      <h1>Descarga nuestra App</h1>
                      <p>Disponible próximamente en iOS y Android</p>
                    </div>
                  }
                />

                {/* 404 */}
                <Route
                  path="*"
                  element={
                    <div className="placeholder-page">
                      <h1>404 - Página no encontrada</h1>
                      <p>La página que buscas no existe.</p>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;