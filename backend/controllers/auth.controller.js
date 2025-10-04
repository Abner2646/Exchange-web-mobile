const jwt = require('jsonwebtoken');

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

module.exports = new AuthController();