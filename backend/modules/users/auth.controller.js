// controllers/auth.controller.js
// Solo la lógica de autenticación de google, la normal está en controllers/user.controller.js

// controllers/auth.controller.js
// Solo la lógica de autenticación de google, la normal está en controllers/user.controller.js

const jwt = require('jsonwebtoken');

class AuthController {
  googleCallback(req, res) {
    const token = jwt.sign(
      { 
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role || 'normal',
        emailVerified: true, // ⭐ AGREGADO - Google verifica emails automáticamente
        googleId: req.user.googleId, // ⭐ AGREGADO - ID de Google del usuario
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const redirectUrl = req.user.isNewUser 
      ? `${process.env.FRONTEND_URL}/auth-success?token=${token}&new=true`
      : `${process.env.FRONTEND_URL}/auth-success?token=${token}`;
      
    res.redirect(redirectUrl);
  }

  async logout(req, res) {
    // 1) Invalidación SERVER-SIDE del JWT: estampar User.lastLogoutAt. El authMiddleware ya rechaza
    //    todo token cuyo `iat` sea anterior a lastLogoutAt → tras el logout, el token (y cualquier otro
    //    emitido antes) deja de ser válido aunque alguien lo haya copiado. El front llama a ESTE endpoint
    //    con su Bearer token, así que sacamos el usuario de ahí. Logout idempotente: sin token válido,
    //    igual cerramos sesión (no exponemos el motivo del fallo de verificación).
    try {
      let token = req.header('Authorization') || '';
      if (token.startsWith('Bearer ')) token = token.slice(7);
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { User } = require('../../models');
        await User.logout(decoded.id);
      }
    } catch (e) {
      // token ausente/inválido/expirado → el logout procede igual
    }

    // 2) Logout de passport + destruir la sesión del server + borrar la cookie (mismos atributos que
    //    la seteó express-session, si no el browser no la elimina).
    const finish = () => {
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      });
      res.json({ message: 'Session closed successfully' });
    };
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Error logging out' });
      }
      if (req.session) {
        return req.session.destroy(() => finish());
      }
      return finish();
    });
  }
}

module.exports = new AuthController();

// Sugerencia de cambio más robusta (no implementada todavía porque podría romper rutas pero hay que hacerlo por seguridad)
// El código anteior pasa tokens en la ruta!!
// -Testear este nuevo en desarrollo primero

/*
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
          role: req.user.role || 'normal'
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
*/