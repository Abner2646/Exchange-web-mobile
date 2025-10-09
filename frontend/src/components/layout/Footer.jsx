import '../../styles/Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div>
            <h3 className="footer-section-title">BitFlow</h3>
            <p className="footer-description">
              Simple. Seguro. BitFlow.
            </p>
          </div>
          
          <div>
            <h4 className="footer-section-title">Enlaces</h4>
            <ul className="footer-links">
              <li><a href="#">Sobre Nosotros</a></li>
              <li><a href="/super_admin">Soy administrador del sistema</a></li>
              <li><a href="#">Términos y condiciones del servicio</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="footer-section-title">Contacto</h4>
            <ul className="footer-contact">
              <li>Email: contacto@bitflow.com</li>
              <li>Tel: +1 123 456 7890</li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2025 BitFlow. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;