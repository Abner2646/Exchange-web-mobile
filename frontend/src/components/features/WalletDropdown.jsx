// src/components/features/WalletDropdown.jsx
import { Link } from 'react-router-dom';
import {
  WalletIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

const WalletDropdown = ({ onClose, onMouseEnter, onMouseLeave }) => {
  const handleLinkClick = () => {
    onClose?.();
  };

  return (
    <div
      className="navbar-dropdown-menu navbar-wallet-dropdown-menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Link to="/activos" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <WalletIcon className="navbar-dropdown-icon" />
        Mis Activos
      </Link>
      <Link to="/depositos" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <ArrowDownTrayIcon className="navbar-dropdown-icon" />
        Depositar
      </Link>
      <Link to="/retiros" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <ArrowUpTrayIcon className="navbar-dropdown-icon" />
        Retirar
      </Link>
      <Link to="/transferir" className="navbar-dropdown-item" onClick={handleLinkClick}>
        <PaperAirplaneIcon className="navbar-dropdown-icon" />
        Transferir
      </Link>
    </div>
  );
};

export default WalletDropdown;