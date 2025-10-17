// src/components/features/UserDropdown.jsx
import { Link } from 'react-router-dom';
import {
  WalletIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const UserDropdown = ({ onLogout, onClose, onMouseEnter, onMouseLeave }) => {
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
      <Link to="/activos" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <WalletIcon className="navbar-dropdown-icon" />
        Activos
      </Link>
      <Link to="/p2p/misOfertas" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <BanknotesIcon className="navbar-dropdown-icon" />
        Mis Ofertas
      </Link>
      <Link to="/perfil" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <Cog6ToothIcon className="navbar-dropdown-icon" />
        Configuración
      </Link>
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