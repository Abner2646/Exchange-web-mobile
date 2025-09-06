import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Login from './pages/login';
import Products from './pages/products';
import Categories from './pages/categories';
import Transactions from './pages/transactions';
import SingUp from './pages/signUp.jsx';
import Company from './pages/company.jsx'
import AuthSuccess from './components/AuthSuccess';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import './styles/theme-system.css';


function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    {/* Floating theme switcher button available on all pages */}
                    <ThemeToggle />
                    
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/categories" element={<Categories />} />
                        <Route path="/transactions" element={<Transactions />} />
                        <Route path="/register" element={<SingUp />} />
                        <Route path="/company" element={<Company />} />
                        <Route path="/auth-success" element={<AuthSuccess />} />
                    </Routes>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;