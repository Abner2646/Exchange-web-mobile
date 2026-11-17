// user_signup_info — one row per user (1:1) persisting signup intelligence as USER DATA
// (not a rotating log): where/how the account was created, so operators can tell real
// users from bots/fakes. Populated once at registration; geo fields are enriched
// best-effort right after. See signupIntel.service.js.
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'UserSignupInfo',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },

      // How the account was created.
      method: { type: DataTypes.STRING(16), allowNull: true }, // 'google' | 'password'

      // Raw network/device at signup.
      signupIp: { type: DataTypes.STRING(45), allowNull: true }, // IPv4/IPv6
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      browser: { type: DataTypes.STRING, allowNull: true },
      os: { type: DataTypes.STRING, allowNull: true },
      deviceType: { type: DataTypes.STRING(16), allowNull: true }, // mobile|tablet|desktop|bot|unknown
      isBot: { type: DataTypes.BOOLEAN, allowNull: true },

      // How they found the exchange (first-touch attribution).
      referer: { type: DataTypes.TEXT, allowNull: true },
      landingPath: { type: DataTypes.STRING, allowNull: true },
      utmSource: { type: DataTypes.STRING, allowNull: true },
      utmMedium: { type: DataTypes.STRING, allowNull: true },
      utmCampaign: { type: DataTypes.STRING, allowNull: true },
      acquisitionSource: { type: DataTypes.STRING, allowNull: true }, // google_search|direct|referral|campaign|...
      acquisitionDetail: { type: DataTypes.STRING, allowNull: true }, // e.g. the referring domain / search engine

      // Geolocation of the signup IP (the REAL location, vs the user-declared country on users.country).
      ipCountryCode: { type: DataTypes.STRING(2), allowNull: true },
      ipCountry: { type: DataTypes.STRING, allowNull: true },
      ipRegion: { type: DataTypes.STRING, allowNull: true },
      ipCity: { type: DataTypes.STRING, allowNull: true },
      ipIsp: { type: DataTypes.STRING, allowNull: true },
      ipAsn: { type: DataTypes.STRING, allowNull: true },
      ipIsProxyVpn: { type: DataTypes.BOOLEAN, allowNull: true },
      ipIsHosting: { type: DataTypes.BOOLEAN, allowNull: true },
      geoResolvedAt: { type: DataTypes.DATE, allowNull: true },
      geoError: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'user_signup_info',
      underscored: true,
      timestamps: true,
    },
  );
