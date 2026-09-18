// src/components/features/UserDropdown.jsx
import { Link } from 'react-router-dom';
import {
  WalletIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  BanknotesIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

const UserDropdown = ({ onLogout, onClose, onMouseEnter, onMouseLeave }) => {
  const { user } = useAuth();
  const userRole = user?.role || user?.rol;
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';

  const handleLinkClick = () => {
    onClose();
  };

  const handleLogoutClick = () => {
    onLogout();
    onClose();
  };

  return (
    <div
      className="navbar-dropdown-menu navbar-user-dropdown-menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Link to="/perfil" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <Cog6ToothIcon className="navbar-dropdown-icon" />
        Mi Perfil
      </Link>
      <Link to="/activos" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <WalletIcon className="navbar-dropdown-icon" />
        Mis Activos
      </Link>
      <Link to="/p2p/misOfertas" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <BanknotesIcon className="navbar-dropdown-icon" />
        Mis Ofertas P2P
      </Link>
      {isAdmin && (
        <Link to="/super_admin" className="navbar-dropdown-item" onClick={handleLinkClick}>
          <ShieldCheckIcon className="navbar-dropdown-icon" />
          Panel Administrador
        </Link>
      )}
      <div className="navbar-dropdown-divider"></div>
      <div className="navbar-dropdown-logout">
        <button onClick={handleLogoutClick} className="navbar-logout-btn">
          <ArrowLeftOnRectangleIcon className="navbar-dropdown-icon" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default UserDropdown;