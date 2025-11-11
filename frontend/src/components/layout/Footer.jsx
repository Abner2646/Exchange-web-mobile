import '../../styles/Footer.css';
import { useTheme } from '../../context/ThemeContext';

const Footer = () => {
  const { theme, themeMode } = useTheme();

  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Línea separadora superior */}
        <div className="footer-divider"></div>
        
        <div className="footer-grid">
          {/* Columna 1: Brand y Descripción */}
          <div className="footer-brand">
            <div className="footer-logo">
              <h3 className="footer-brand-title">BitFlow</h3>
              <div className="footer-badge">Exchange</div>
            </div>
            <p className="footer-description">
              Plataforma de trading avanzada. Simple. Seguro. Confiable.
            </p>
            <div className="footer-social">
              <a href="#" className="footer-social-link" aria-label="Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" className="footer-social-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
                </svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" className="footer-social-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="Discord">
                <svg xmlns="http://www.w3.org/2000/svg" className="footer-social-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.078.078 0 0 0-.055-.108 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.8 8.18 1.8 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.078.078 0 0 0-.055.108 14.301 14.301 0 0 0 1.225 1.994.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.334-.956 2.419-2.157 2.419z"/>
                </svg>
              </a>
              <a href="#" className="footer-social-link" aria-label="Telegram">
                <svg xmlns="http://www.w3.org/2000/svg" className="footer-social-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.064-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Columna 2: Producto */}
          <div className="footer-section">
            <h4 className="footer-section-title">Producto</h4>
            <ul className="footer-links">
              <li><a href="/spot" className="footer-link">Trading Spot</a></li>
              <li><a href="/futures" className="footer-link">Trading Futuros</a></li>
              <li><a href="/earn" className="footer-link">BitFlow Earn</a></li>
              <li><a href="/wallet" className="footer-link">Wallet</a></li>
              <li><a href="/api" className="footer-link">API Trading</a></li>
            </ul>
          </div>

          {/* Columna 3: Recursos */}
          <div className="footer-section">
            <h4 className="footer-section-title">Recursos</h4>
            <ul className="footer-links">
              <li><a href="/help" className="footer-link">Centro de Ayuda</a></li>
              <li><a href="/blog" className="footer-link">Blog</a></li>
              <li><a href="/academy" className="footer-link">Academia</a></li>
              <li><a href="/download" className="footer-link">Descargas</a></li>
              <li><a href="/status" className="footer-link">Estado del Sistema</a></li>
            </ul>
          </div>

          {/* Columna 4: Legal */}
          <div className="footer-section">
            <h4 className="footer-section-title">Legal</h4>
            <ul className="footer-links">
              <li><a href="/privacy" className="footer-link">Política de Privacidad</a></li>
              <li><a href="/terms" className="footer-link">Términos de Servicio</a></li>
              <li><a href="/cookies" className="footer-link">Política de Cookies</a></li>
              <li><a href="/aml" className="footer-link">Política AML</a></li>
              <li><a href="/disclaimer" className="footer-link">Descargo de Responsabilidad</a></li>
            </ul>
          </div>

          {/* Columna 5: Empresa (Simplificada) */}
          <div className="footer-section">
            <h4 className="footer-section-title">Empresa</h4>
            <ul className="footer-links">
              <li><a href="/about" className="footer-link">Sobre Nosotros</a></li>
              <li><a href="/news" className="footer-link">Noticias</a></li>
              <li><a href="/super_admin" className="footer-link footer-admin">Soy Administrador</a></li>
            </ul>
            
            <div className="footer-contact">
              <div className="footer-contact-item">
                <span className="footer-contact-label">Email:</span>
                <a href="mailto:contacto@bitflow.com" className="footer-contact-link">contacto@bitflow.com</a>
              </div>
              <div className="footer-contact-item">
                <span className="footer-contact-label">Teléfono:</span>
                <a href="tel:+11234567890" className="footer-contact-link">+1 123 456 7890</a>
              </div>
            </div>
          </div>

          {/* Columna 6: Newsletter */}
          <div className="footer-newsletter">
            <h4 className="footer-section-title">Mantente Informado</h4>
            <p className="footer-newsletter-description">
              Recibe las últimas actualizaciones y noticias del mercado.
            </p>
            <form className="footer-newsletter-form">
              <div className="footer-input-group">
                <input 
                  type="email" 
                  placeholder="tu@email.com"
                  className="footer-input"
                  required
                />
                <button type="submit" className="footer-newsletter-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" className="footer-newsletter-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/>
                  </svg>
                </button>
              </div>
            </form>
            <div className="footer-newsletter-note">
              Al suscribirte aceptas nuestra Política de Privacidad
            </div>
          </div>
        </div>

        {/* Sección de Seguridad y Certificaciones */}
        {/*<div className="footer-security">
          <div className="footer-security-badges">
            <div className="footer-badge-security">
              <svg xmlns="http://www.w3.org/2000/svg" className="footer-badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              SSL Seguro
            </div>
            <div className="footer-badge-security">
              <svg xmlns="http://www.w3.org/2000/svg" className="footer-badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
              ISO 27001
            </div>
            <div className="footer-badge-security">
              <svg xmlns="http://www.w3.org/2000/svg" className="footer-badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
              </svg>
              Fondos Asegurados
            </div>
            <div className="footer-badge-security">
              <svg xmlns="http://www.w3.org/2000/svg" className="footer-badge-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.08 5.227A3 3 0 016.979 3H17.02a3 3 0 012.9 2.227l2.113 7.926A5.228 5.228 0 0018.75 12H5.25a5.228 5.228 0 00-3.284 1.153L4.08 5.227z" />
                <path fillRule="evenodd" d="M5.25 13.5a3.75 3.75 0 100 7.5h13.5a3.75 3.75 0 100-7.5H5.25zm10.5 4.5a.75.75 0 100-1.5.75.75 0 000 1.5zm3.75-.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" clipRule="evenodd" />
              </svg>
              Servidor Seguro
            </div>
          </div>
        </div>*/}

        {/* Línea separadora */}
        {/*<div className="footer-divider"></div>*/}

        {/* Sección inferior */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="footer-copyright">
              <p>&copy; 2025 BitFlow Technologies Ltd. Todos los derechos reservados.</p>
              <div className="footer-legal-info">
                <span>NIF: B12345678</span>
                <span className="footer-legal-separator">•</span>
                <span>Registro Mercantil: Tomo 12345, Folio 67, Hoja M-123456</span>
              </div>
              <div className="footer-development">
                Desarrollado por {' '}
                <a 
                  href="https://tu-software-factory.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-development-link"
                >
                  Nombre de la Software Factory
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;