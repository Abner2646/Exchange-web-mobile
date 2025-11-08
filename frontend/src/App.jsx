// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import RequireEmailVerified from './components/common/RequireEmailVerified.jsx';
import ScrollToTop from './components/common/ScrollToTop.jsx';

// Páginas públicas
import HomePage from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register.jsx';
import AuthSuccess from './pages/AuthSuccess';

// Páginas protegidas
import VerificarEmail from './pages/VerificarEmail.jsx';
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
import Trading from './pages/Trading.jsx'

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
            {/*<Toaster position="top-right" />*/}
            <Routes>
              <Route path="/" element={<Layout />}>
                {/* ========== RUTAS PÚBLICAS ========== */}
                <Route index element={<HomePage />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="auth-success" element={<AuthSuccess />} />

                {/* ========== RUTAS PROTEGIDAS (solo autenticación) ========== */}

                {/* Verificar email - Solo requiere estar autenticado */}
                <Route
                  path="verificar-email"
                  element={
                    <ProtectedRoute>
                      <VerificarEmail />
                    </ProtectedRoute>
                  }
                />

                {/* Perfil - Solo requiere estar autenticado (para que puedan verificar desde aquí) */}
                <Route
                  path="perfil"
                  element={
                    <ProtectedRoute>
                      <ConfiguracionPerfil />
                    </ProtectedRoute>
                  }
                />

                {/* Notificaciones - Solo requiere estar autenticado */}
                <Route
                  path="notificaciones"
                  element={
                    <ProtectedRoute>
                      <Notificaciones />
                    </ProtectedRoute>
                  }
                />

                {/* ========== RUTAS QUE REQUIEREN EMAIL VERIFICADO ========== */}

                {/* Swap - Requiere email verificado */}
                <Route
                  path="swap"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <Swap />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="trading"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <Trading />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />

                {/* P2P - Requiere email verificado */}
                <Route
                  path="p2p"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <P2PMarketplace />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="p2p/transaction/:id"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <P2PTransaction />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="p2p/crearOferta"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <CrearOfertaP2P />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="p2p/misOfertas"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <MisOfertas />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />

                {/* Wallet - Requiere email verificado */}
                <Route
                  path="activos"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <Activos />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="depositos"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <Depositos />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="retiros"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <Withdrawal />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="transferir"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <Transferencia />
                      </RequireEmailVerified>
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin - Requiere email verificado */}
                <Route
                  path="super_admin"
                  element={
                    <ProtectedRoute>
                      <RequireEmailVerified>
                        <SuperAdmin />
                      </RequireEmailVerified>
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