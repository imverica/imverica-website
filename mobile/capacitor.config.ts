import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Imverica mobile app configuration.
 *
 * Strategy: app shell + native plugins; live content loads from imverica.com.
 * - One codebase → iOS + Android (Capacitor wraps a WebView around web content).
 * - Marketing landing pages, intake wizard, cabinet, and admin console all
 *   continue to live on imverica.com — the app is a thin native shell with
 *   push notifications, camera document scanning, and biometric login.
 * - Updates to imverica.com propagate to the app instantly without an App
 *   Store re-release (until we change the native shell itself).
 *
 * The native shell adds enough value (push, camera, biometrics, share sheet)
 * to pass App Store 4.2 (Minimum Functionality) review.
 */
const config: CapacitorConfig = {
  appId: 'com.imverica.app',
  appName: 'Imverica',
  // webDir is the local fallback bundle copied into the native projects.
  // We populate it with a small offline-ready shell so the app loads
  // something useful even before it reaches the network.
  webDir: 'www',
  server: {
    // Load live content from production. iOS uses ATS; the URL must be HTTPS.
    url: 'https://imverica.com',
    cleartext: false,
    // Treat imverica.com as our own origin — allow any subpath to navigate
    // inside the WebView instead of opening Safari.
    allowNavigation: [
      'imverica.com',
      '*.imverica.com',
      // Google Identity Services (popup window during sign-in)
      'accounts.google.com',
      'www.google.com',
      // Browser-side font loads
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ]
  },
  ios: {
    // Allow Apple's webview to load mixed-content blobs on PDF previews.
    contentInset: 'always',
    // Hide the URL bar (we're presenting as a native app, not a browser).
    limitsNavigationsToAppBoundDomains: false,
    // Default scheme; matches deep-link routing.
    scheme: 'Imverica'
  },
  android: {
    // Allow http://10.0.2.2 (Android emulator localhost) during development.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      // Show splash for max 2s, then auto-hide once the page is ready.
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1a2e4a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    StatusBar: {
      // Match the navy brand header.
      backgroundColor: '#1a2e4a',
      style: 'DARK'
    },
    PushNotifications: {
      // Request the standard alert/sound/badge presentation options.
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
