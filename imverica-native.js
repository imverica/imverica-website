/**
 * Imverica native bridge — runs in every page loaded inside the iOS / Android
 * Capacitor app. Safe to load on the open web (degrades to no-op).
 *
 * Exposes `window.imvNative` with helpers used by /account, /portal, etc:
 *   imvNative.isApp        → true when running inside Capacitor shell
 *   imvNative.platform     → 'ios' | 'android' | 'web'
 *   imvNative.biometric()  → resolves with {available, type} ('face' | 'finger')
 *   imvNative.bioVerify()  → triggers system Face ID / Touch ID / fingerprint prompt
 *   imvNative.share(opts)  → native share sheet
 *   imvNative.openExt(url) → open in system browser (not in our WebView)
 *   imvNative.registerPush() → request push permission + return token
 *   imvNative.onPush(cb)   → callback for incoming push payloads
 *   imvNative.onResume(cb) → fires when app comes back to foreground
 *
 * Loaded as a static asset from the Astro site so the same JS works
 * whether the user is on the public web or inside the wrapper app.
 */
(function () {
  'use strict';

  var w = window;
  var hasCapacitor = !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  var platform = hasCapacitor ? (w.Capacitor.getPlatform ? w.Capacitor.getPlatform() : 'unknown') : 'web';

  // Mark <html> so CSS can target app vs web ("in-app" class).
  if (hasCapacitor) {
    document.documentElement.classList.add('in-app', 'in-app-' + platform);
  }

  // Resolves a plugin from window.Capacitor.Plugins. Returns null on web.
  function plug(name) {
    if (!hasCapacitor || !w.Capacitor.Plugins) return null;
    return w.Capacitor.Plugins[name] || null;
  }

  var api = {
    isApp: hasCapacitor,
    platform: platform,

    /**
     * Check if device biometric (Face ID / Touch ID / fingerprint) is set up
     * and the user has enabled it on this device. Returns
     *   { available: bool, type: 'face' | 'finger' | 'none', reason: string }
     */
    biometric: function () {
      var P = plug('BiometricAuth');
      if (!P) return Promise.resolve({ available: false, type: 'none', reason: 'not-app' });
      return P.checkBiometry().then(function (r) {
        // Plugin returns { isAvailable, biometryType, biometryTypes, ... }
        var t = 'none';
        if (r.biometryType === 'faceId' || r.biometryType === 'faceAuthentication') t = 'face';
        else if (r.biometryType === 'touchId' || r.biometryType === 'fingerprintAuthentication') t = 'finger';
        else if (r.isAvailable) t = 'finger'; // generic fallback
        return { available: !!r.isAvailable, type: t, reason: r.reason || '' };
      }).catch(function () {
        return { available: false, type: 'none', reason: 'error' };
      });
    },

    /**
     * Trigger the system biometric prompt. Resolves with { ok: true } on
     * success or { ok: false, reason } on cancel/lockout/etc.
     */
    bioVerify: function (reason) {
      var P = plug('BiometricAuth');
      if (!P) return Promise.resolve({ ok: false, reason: 'not-app' });
      return P.authenticate({
        reason: reason || 'Unlock Imverica',
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Use passcode',
        androidTitle: 'Imverica',
        androidSubtitle: 'Verify it\'s you',
        androidConfirmationRequired: false
      }).then(function () {
        return { ok: true };
      }).catch(function (err) {
        return { ok: false, reason: (err && err.code) || 'cancelled' };
      });
    },

    /**
     * Native share sheet. opts = { title, text, url, dialogTitle }
     */
    share: function (opts) {
      var P = plug('Share');
      if (!P) {
        // Fallback to navigator.share on the open web.
        if (navigator.share) return navigator.share(opts || {}).catch(function () {});
        return Promise.resolve();
      }
      return P.share(opts || {}).catch(function () {});
    },

    /**
     * Open a URL in the system browser instead of in our WebView.
     * Useful for external links (Google Maps, government sites, etc.)
     */
    openExt: function (url) {
      var P = plug('Browser');
      if (P && P.open) return P.open({ url: url, presentationStyle: 'popover' });
      w.open(url, '_blank', 'noopener');
      return Promise.resolve();
    },

    /**
     * Register the device for push notifications.
     * Resolves with { granted, token } — backend should POST token to
     * /api/auth?action=push-register to enable case-update alerts.
     */
    registerPush: function () {
      var P = plug('PushNotifications');
      if (!P) return Promise.resolve({ granted: false, token: null });
      return P.requestPermissions().then(function (perm) {
        if (perm.receive !== 'granted') return { granted: false, token: null };
        return new Promise(function (resolve) {
          var done = false;
          P.addListener('registration', function (evt) {
            if (done) return; done = true;
            resolve({ granted: true, token: evt.value });
          });
          P.addListener('registrationError', function () {
            if (done) return; done = true;
            resolve({ granted: true, token: null });
          });
          P.register();
          // Safety timeout
          setTimeout(function () {
            if (done) return; done = true;
            resolve({ granted: true, token: null });
          }, 8000);
        });
      });
    },

    /**
     * Subscribe to incoming push notifications. Callback receives the
     * raw notification payload.
     */
    onPush: function (cb) {
      var P = plug('PushNotifications');
      if (!P) return function () {};
      var sub1 = P.addListener('pushNotificationReceived', cb);
      var sub2 = P.addListener('pushNotificationActionPerformed', function (evt) {
        try { cb(evt.notification, evt); } catch (e) {}
      });
      return function () {
        if (sub1 && sub1.remove) sub1.remove();
        if (sub2 && sub2.remove) sub2.remove();
      };
    },

    /**
     * Fires when the app comes back to the foreground (user switched away
     * and returned). Useful to re-fetch case status or refresh session.
     */
    onResume: function (cb) {
      var P = plug('App');
      if (!P) {
        // Web fallback: page visibility.
        var handler = function () {
          if (document.visibilityState === 'visible') cb();
        };
        document.addEventListener('visibilitychange', handler);
        return function () {
          document.removeEventListener('visibilitychange', handler);
        };
      }
      var sub = P.addListener('appStateChange', function (state) {
        if (state.isActive) cb();
      });
      return function () { if (sub && sub.remove) sub.remove(); };
    }
  };

  w.imvNative = api;

  // ===== Android hardware back button =====
  // Without this, tapping Android's back button at any in-page state
  // exits the app (Capacitor default). We instead pop the WebView's
  // history if there's anywhere to go back to; only exit when at the root.
  if (hasCapacitor && platform === 'android') {
    var AppPlugin = plug('App');
    if (AppPlugin && AppPlugin.addListener) {
      AppPlugin.addListener('backButton', function (evt) {
        // If there's web history, go back.
        if (w.history.length > 1 && document.referrer) {
          w.history.back();
          return;
        }
        // At the root → confirm exit on second tap within 2s, like
        // standard Android app pattern.
        if (w.__imvBackPrompt) {
          AppPlugin.exitApp();
          return;
        }
        w.__imvBackPrompt = true;
        setTimeout(function () { w.__imvBackPrompt = false; }, 2000);
        // Subtle toast via web (since we can't trigger native Toast
        // cross-platform without another plugin).
        try {
          var t = document.createElement('div');
          t.textContent = 'Press back again to exit';
          t.style.cssText = 'position:fixed;bottom:50px;left:50%;transform:translateX(-50%);background:rgba(20,20,30,0.92);color:#fff;padding:10px 18px;border-radius:24px;font-size:13px;z-index:99999;pointer-events:none;font-family:system-ui;';
          document.body.appendChild(t);
          setTimeout(function () { try { t.remove(); } catch (e) {} }, 1900);
        } catch (e) {}
      });
    }
  }

  // ===== iOS / Android: handle in-app deep links =====
  // When a notification or external link triggers `imverica://order/123`
  // or a Universal Link, Capacitor fires `appUrlOpen`. We translate that
  // into a same-origin navigation inside the WebView.
  if (hasCapacitor) {
    var AppPlugin2 = plug('App');
    if (AppPlugin2 && AppPlugin2.addListener) {
      AppPlugin2.addListener('appUrlOpen', function (evt) {
        if (!evt || !evt.url) return;
        var url = evt.url;
        // Translate imverica://path → https://imverica.com/path
        if (url.indexOf('imverica://') === 0) {
          url = 'https://imverica.com/' + url.replace('imverica://', '');
        }
        // Only follow if same origin (https://imverica.com); otherwise drop.
        try {
          var u = new URL(url);
          if (u.hostname === 'imverica.com' || u.hostname.endsWith('.imverica.com')) {
            w.location.href = u.pathname + u.search + u.hash;
          }
        } catch (e) {}
      });
    }
  }

  // Helpful debug log when running inside the app.
  if (hasCapacitor) {
    try {
      console.log('[imvNative]', 'platform=' + platform, 'plugins=' +
        Object.keys((w.Capacitor && w.Capacitor.Plugins) || {}).join(','));
    } catch (e) {}
  }
})();
