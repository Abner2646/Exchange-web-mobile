const jwt = require('jsonwebtoken');
/*
class AuthController {
  googleCallback(req, res) {
    const token = jwt.sign(
      { 
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        rol: req.user.rol || 'normal'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const redirectUrl = req.user.isNewUser 
      ? `${process.env.FRONTEND_URL}/auth-success?token=${token}&new=true`
      : `${process.env.FRONTEND_URL}/auth-success?token=${token}`;
      
    res.redirect(redirectUrl);
  }

  logout(req, res) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Error logging out' });
      }
      res.json({ message: 'Session closed successfully' });
    });
  }
}

module.exports = new AuthController();*/

// Sugerencia de cambio más robusta (no implementada todavía porque podría romper rutas pero hay que hacerlo por seguridad)
// El código anteior pasa tokens en la ruta!!

const jwt = require('jsonwebtoken');

class AuthController {
  googleCallback(req, res) {
    try {
      // Validar que el usuario existe
      if (!req.user) {
        console.error('❌ No user in request');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
      }

      // Validar JWT_SECRET
      if (!process.env.JWT_SECRET) {
        console.error('❌ JWT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // Generar token
      const token = jwt.sign(
        { 
          id: req.user.id,
          email: req.user.email,
          username: req.user.username,
          rol: req.user.rol || 'normal'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Construir URL de redirección
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = req.user.isNewUser 
        ? `${frontendURL}/auth-success?token=${token}&new=true`
        : `${frontendURL}/auth-success?token=${token}`;
      
      console.log('✅ Google OAuth success, redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('❌ Error in googleCallback:', error);
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/login?error=auth_error`);
    }
  }

  logout(req, res) {
    req.logout((err) => {
      if (err) {
        console.error('❌ Error logging out:', err);
        return res.status(500).json({ error: 'Error logging out' });
      }
      res.json({ message: 'Session closed successfully' });
    });
  }
}

module.exports = new AuthController();
