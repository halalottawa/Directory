const config = {
  appId: 'com.app.halaottawaapk',
  appName: 'Halal Ottawa',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
