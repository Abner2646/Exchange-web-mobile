// signupIntel.service — capture + enrich the per-user signup intelligence (IP, device,
// how they found us, real geolocation). Called once per NEW account from the register /
// Google paths. Never throws into the signup flow: a capture failure must not block or
// roll back a registration, so everything here is best-effort and swallowed.
const https = require('https');
const http = require('http');

// ── Client IP ────────────────────────────────────────────────────────────────
// Behind nginx, req.ip is the proxy. The real client sits at the head of
// X-Forwarded-For (nginx appends it). Fall back to req.ip / socket.
function extractClientIp(req) {
  if (!req) return null;
  const xff = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  let ip = xff || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  return ip || null;
}

// ── User-Agent parsing (lightweight, no dependency) ────────────────────────────
function parseUserAgent(ua) {
  const s = String(ua || '');
  const low = s.toLowerCase();
  const isBot = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|curl|wget|python-requests|axios|go-http|java\/|okhttp|scrapy/i.test(s);

  let os = 'Unknown';
  if (/windows nt/i.test(s)) os = 'Windows';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(s)) os = 'iOS';
  else if (/mac os x/i.test(s)) os = 'macOS';
  else if (/cros/i.test(s)) os = 'ChromeOS';
  else if (/linux/i.test(s)) os = 'Linux';

  let browser = 'Unknown';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/samsungbrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/opr\/|opera/i.test(s)) browser = 'Opera';
  else if (/firefox\//i.test(s)) browser = 'Firefox';
  else if (/chrome\//i.test(s)) browser = 'Chrome';
  else if (/safari\//i.test(s) && /version\//i.test(s)) browser = 'Safari';

  let deviceType = 'desktop';
  if (isBot) deviceType = 'bot';
  else if (/ipad|tablet/i.test(low)) deviceType = 'tablet';
  else if (/mobi|android|iphone|ipod/i.test(low)) deviceType = 'mobile';
  if (!s) deviceType = 'unknown';

  return { browser, os, deviceType, isBot };
}

// ── Acquisition (how they found the exchange — first-touch) ─────────────────────
function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
const SEARCH_ENGINES = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', 'yahoo': 'Yahoo', yandex: 'Yandex', ecosia: 'Ecosia', brave: 'Brave', baidu: 'Baidu' };

function deriveAcquisition({ referer, utmSource, utmMedium, utmCampaign }) {
  if (utmSource) {
    return { source: 'campaign', detail: [utmSource, utmMedium, utmCampaign].filter(Boolean).join(' / ') };
  }
  const d = domainOf(referer || '');
  if (!d) return { source: 'direct', detail: null }; // typed URL / bookmark / no referer
  const bare = d.replace(/\.(com|net|org|io|co|dev|app)(\.[a-z]{2})?$/i, '');
  for (const key of Object.keys(SEARCH_ENGINES)) {
    if (d.includes(key)) {
      // accounts.google.com is the OAuth hop, not a real search source
      if (key === 'google' && /accounts\.google/i.test(d)) return { source: 'oauth', detail: 'Google OAuth' };
      return { source: 'search', detail: SEARCH_ENGINES[key] };
    }
  }
  if (/facebook|instagram|t\.co|twitter|x\.com|linkedin|reddit|tiktok|youtube|t\.me|telegram/i.test(d)) {
    return { source: 'social', detail: d };
  }
  // same-site referer = internal navigation, not an external source
  if (/bitflow\.community/i.test(d)) return { source: 'direct', detail: null };
  return { source: 'referral', detail: d };
}

// ── Geolocation (ip-api, free tier, no key) ─────────────────────────────────────
function isPrivateIp(ip) {
  return !ip || ip === '127.0.0.1' || ip === '::1' || /^10\./.test(ip) || /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || /^169\.254\./.test(ip) || /^fc00:|^fe80:/i.test(ip);
}

function geolocate(ip) {
  return new Promise((resolve) => {
    if (isPrivateIp(ip)) return resolve({ error: 'private_or_missing_ip' });
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,isp,as,proxy,hosting,query`;
    const req = http.get(url, { timeout: 4000 }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (j.status !== 'success') return resolve({ error: j.message || 'geo_failed' });
          resolve({
            countryCode: j.countryCode || null, country: j.country || null, region: j.regionName || null,
            city: j.city || null, isp: j.isp || null, asn: j.as || null, proxy: !!j.proxy, hosting: !!j.hosting,
          });
        } catch (e) { resolve({ error: 'geo_parse_error' }); }
      });
    });
    req.on('error', () => resolve({ error: 'geo_network_error' }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'geo_timeout' }); });
  });
}

async function enrichGeo(rowId, ip) {
  const { UserSignupInfo } = require('../../models');
  const g = await geolocate(ip);
  const patch = g.error
    ? { geoError: g.error, geoResolvedAt: new Date() }
    : { ipCountryCode: g.countryCode, ipCountry: g.country, ipRegion: g.region, ipCity: g.city,
        ipIsp: g.isp, ipAsn: g.asn, ipIsProxyVpn: g.proxy, ipIsHosting: g.hosting, geoResolvedAt: new Date(), geoError: null };
  await UserSignupInfo.update(patch, { where: { id: rowId } });
}

// ── Public: capture one signup ──────────────────────────────────────────────────
// firstTouch (optional): { referer, landing, utmSource, utmMedium, utmCampaign, ua } captured
// at the REAL landing page by the frontend (so Google OAuth signups still attribute to the
// original source, not accounts.google.com). Falls back to request headers when absent.
async function captureSignup({ userId, method, req, firstTouch }) {
  try {
    const { UserSignupInfo } = require('../../models');
    const ft = firstTouch || {};
    const ua = ft.ua || req?.headers?.['user-agent'] || '';
    const ip = extractClientIp(req);
    const referer = ft.referer || req?.headers?.['referer'] || req?.headers?.['referrer'] || '';
    const dev = parseUserAgent(ua);
    const acq = deriveAcquisition({ referer, utmSource: ft.utmSource, utmMedium: ft.utmMedium, utmCampaign: ft.utmCampaign });

    const [row] = await UserSignupInfo.findOrCreate({
      where: { userId },
      defaults: {
        userId, method, signupIp: ip, userAgent: ua,
        browser: dev.browser, os: dev.os, deviceType: dev.deviceType, isBot: dev.isBot,
        referer: referer || null, landingPath: ft.landing || null,
        utmSource: ft.utmSource || null, utmMedium: ft.utmMedium || null, utmCampaign: ft.utmCampaign || null,
        acquisitionSource: acq.source, acquisitionDetail: acq.detail,
      },
    });
    if (ip && !isPrivateIp(ip)) enrichGeo(row.id, ip).catch((e) => console.error('geo enrich failed: ' + e.message));
    return row;
  } catch (e) {
    console.error('captureSignup failed: ' + e.message);
    return null;
  }
}

module.exports = { captureSignup, parseUserAgent, deriveAcquisition, geolocate, extractClientIp };
