const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const { sequelize } = require('./models');
const routes = require('./routes');
const app = express();
const PORT = process.env.PORT || 3001;

//Google oAuth------------------------------------------------------------------------------------------------
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const jwt = require('jsonwebtoken');

// Basic Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'word',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Setting up Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { User } = require('./models/index');
    
    // Search existing user by googleId
    let existingUser = await User.findOne({ 
      where: { googleId: profile.id } 
    });
    
    if (existingUser) {
      return done(null, { 
        ...existingUser.dataValues, 
        isNewUser: false 
      });
    }
    
    // Find if a user with that email already exists
    let userByEmail = await User.findOne({ 
      where: { email: profile.emails[0].value } 
    });
    
    if (userByEmail) {
      await userByEmail.update({ 
        googleId: profile.id,
        picture: profile.photos[0].value 
      });
      return done(null, { 
        ...userByEmail.dataValues, 
        isNewUser: false 
      });
    }
    
    // Create new user
    const newUser = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      username: profile.displayName || profile.emails[0].value.split('@')[0],
      picture: profile.photos[0].value,
      role: 'user',
      permissions: ['read']
    });
    
    return done(null, { 
      ...newUser.dataValues, 
      isNewUser: true 
    });
    
  } catch (error) {
    console.error('Error in Google OAuth:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google Auth routes BEFORE other routes to avoid errors
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign(
      { 
        userId: req.user.id || req.user.googleId,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role || 'user',
        companyId: req.user.companyId
      },
      process.env.JWT_SECRET || 'jwt-secret-key',
      { expiresIn: '7d' }
    );
    
    const redirectUrl = req.user.isNewUser 
      ? `http://localhost:3000/auth-success?token=${token}&new=true`
      : `http://localhost:3000/auth-success?token=${token}`;
      
    res.redirect(redirectUrl);
  }
);

// Route to logout
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.json({ message: 'Session closed successfully' });
  });
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

//End of Google oAuth--------------------------------------------------------------------------------------------


// Create tables if not exist
const syncDatabase = async () => {
  try {
    await sequelize.sync({ force: false }); 
    console.log('Tables synchronized correctly');
  } catch (error) {
    console.error('Error synchronizing:', error);
  }
};
syncDatabase(); // Important: Call before starting the server


// Security Middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Routes
app.use('/api', routes);

// Health check at the root
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handling routes not found
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize server
async function startServer() {
  try {
    // Test connection to the database
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // In development, synchronize models
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API available at: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    // Continue without database for development
    app.listen(PORT, () => {
      console.log(`⚠️  Server started without database on port ${PORT}`);
    });
  }

  //De los jobs---
  const JobManager = require('./jobs');
  // En la función de inicialización:
  await JobManager.startAll();
  //await blockchainBootstrap.initialize();
  //----------------
}

startServer();

// Graceful closing handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Error closing database:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Error closing database:', error);
  }
  process.exit(0);
});

