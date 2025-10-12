// /components/layout/Layout.jsx

import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ThemeSwitcher from '../ThemeSwitcher';
import '../../styles/Layout.css';

const Layout = () => {
  return (
    <div className="layout-container">
      <Navbar />
      <main className="layout-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;