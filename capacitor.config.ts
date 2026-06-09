const config = {
  appId: 'com.halalottawa.app',
  appName: 'Halal Ottawa',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: '604019460073-nevmio60k9muu0rv6f11d0lb6lo1140c.apps.googleusercontent.com',
      androidClientId: '604019460073-nevmio60k9muu0rv6f11d0lb6lo1140c.apps.googleusercontent.com',
      serverClientId: '604019460073-nevmio60k9muu0rv6f11d0lb6lo1140c.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
