# Imverica Mobile — Launch Checklist

Step-by-step from working dev build → TestFlight + Play Store internal testing → public release.

Everything in this file that's marked **[USER]** requires the human (account creation, payments, identity verification). Everything marked **[CLAUDE]** can be done autonomously by the assistant.

---

## Phase 0 — Status as of last build

- ✅ iOS app builds and runs in iPhone 17 simulator (`com.imverica.app`)
- ✅ Android APK builds (`mobile/android/app/build/outputs/apk/debug/app-debug.apk`, ~9.8 MB)
- ✅ App icons + splash screens generated (113 files: iOS, Android, PWA)
- ✅ Capacitor v7.6.5 with 11 plugins (camera, push, biometric, share, browser, splash, status bar, preferences, app)
- ✅ Permissions wired (Info.plist + AndroidManifest.xml)
- ✅ Custom URL scheme `imverica://`
- ✅ Native bridge JS (`/imverica-native.js`) — biometric, push, share, deep link helpers
- ✅ Cabinet biometric login UI (`/account` shows Face ID button when previously signed in)
- ✅ Push registration backend (`/api/auth?action=push-register`)
- ✅ Deep link scaffolding (`/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`)
- ⏳ Universal Links / App Links — need signing identities to finish
- ⏳ Apple Developer + Google Play accounts
- ⏳ Real APNs key + Firebase project for push delivery

---

## Phase 1 — Apple Developer onboarding **[USER]**

1. Sign in at https://developer.apple.com/programs/enroll/ with the Apple ID
   used for the business. Imverica should enroll as an **Organization** (LLC),
   not individual — needs D-U-N-S number (free, https://developer.apple.com/enroll/duns-lookup/).
2. Pay $99/year. Approval typically 24–48 hours.
3. Once approved:
   - Note the **Team ID** (10-character alphanumeric) shown in
     Membership Details → it goes into `/.well-known/apple-app-site-association`.
   - In **Certificates, Identifiers & Profiles**:
     - Create an **App ID** for `com.imverica.app`. Enable
       *Push Notifications*, *Sign in with Apple*, *Associated Domains*.
     - Create an **APNs Auth Key** (.p8 file). Download once — store
       in 1Password. The Key ID + Team ID go to whatever push backend
       you use (Firebase / OneSignal / our own).
4. In Xcode, open `mobile/ios/App/App.xcworkspace`:
   - Select the *App* target → *Signing & Capabilities*.
   - Set *Team* to Imverica Legal Solutions.
   - Add capabilities: *Push Notifications*, *Associated Domains*.
   - Under Associated Domains, add `applinks:imverica.com`.
5. Tell Claude the Team ID → Claude fills it into AASA file + entitlements.

## Phase 2 — Google Play Console **[USER]**

1. Sign up at https://play.google.com/console/signup. $25 one-time.
2. Pay, fill profile, accept Play Distribution Agreement.
3. Create an **app** (name: Imverica, default language: English, app or game: App, free/paid: Free).
4. Create a **service account** for Play Developer API (used later for automated uploads — optional).

## Phase 3 — Android release keystore **[USER, with Claude scripting]**

Generate ONCE, keep forever. If lost, you can never update your app
on Play Store under this package — it's that important.

```bash
keytool -genkey -v \
  -keystore ~/.android/imverica-release.keystore \
  -alias imverica \
  -keyalg RSA -keysize 2048 -validity 10000
```

Answer prompts (company name, country code = US, state = California, etc.).
**Save passwords in 1Password** under "Imverica Android release keystore".

Then set env vars in `~/.zshrc`:
```bash
export IMVERICA_KEYSTORE_PATH="$HOME/.android/imverica-release.keystore"
export IMVERICA_KEYSTORE_PASSWORD="..."     # the password you just chose
export IMVERICA_KEY_ALIAS="imverica"
export IMVERICA_KEY_PASSWORD="..."           # alias password
```

Get the SHA-256 fingerprint (needed for App Links + Play Console):
```bash
keytool -list -v -keystore ~/.android/imverica-release.keystore \
  -alias imverica | grep SHA256
```

Send the SHA-256 to Claude → updates `/.well-known/assetlinks.json`.

## Phase 4 — Production push notifications **[USER, with Claude scripting]**

For iOS (APNs) and Android (FCM), the simplest unified backend is **Firebase
Cloud Messaging** (free for our volume).

1. Go to https://console.firebase.google.com/ → Add project → name *Imverica*.
2. Add iOS app: bundle `com.imverica.app`. Download `GoogleService-Info.plist`
   → place at `mobile/ios/App/App/GoogleService-Info.plist`.
3. Add Android app: package `com.imverica.app`. Add the release SHA-256
   from Phase 3. Download `google-services.json` → place at
   `mobile/android/app/google-services.json`.
4. In Firebase → Project Settings → Cloud Messaging → upload the APNs
   Auth Key (.p8) from Phase 1.
5. Tell Claude → wires the Firebase Admin SDK into Netlify Functions so
   `pushTokens` stored on user profiles actually trigger alerts.

Both `GoogleService-Info.plist` and `google-services.json` are gitignored.

## Phase 5 — TestFlight (iOS) **[CLAUDE after Phase 1 done]**

```bash
cd mobile/ios/App
xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Release \
  -archivePath build/Imverica.xcarchive archive

xcodebuild -exportArchive \
  -archivePath build/Imverica.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/Export

# Then upload via altool or fastlane:
xcrun altool --upload-app -f build/Export/Imverica.ipa \
  -t ios -u APPLE_ID -p APP_SPECIFIC_PASSWORD
```

App Store Connect → My Apps → Imverica → TestFlight → add internal testers.

## Phase 6 — Play Console internal testing **[CLAUDE after Phase 2 + 3 done]**

```bash
cd mobile/android
export IMVERICA_KEYSTORE_PATH=...  # from Phase 3
export IMVERICA_KEYSTORE_PASSWORD=...
export IMVERICA_KEY_PASSWORD=...

./gradlew bundleRelease
# Produces: app/build/outputs/bundle/release/app-release.aab
```

Play Console → Imverica → Testing → Internal testing → Create new release →
Upload `app-release.aab` → Add testers' Gmail addresses → Save → Review →
Roll out.

Testers get a link to install via Play Store within minutes.

## Phase 7 — Store metadata **[USER + CLAUDE]**

### Apple App Store
- App name (30 char): "Imverica: Legal Documents"
- Subtitle (30 char): "California LDA — at your direction"
- Promotional text (170 char): seasonal — Claude drafts
- Description (4000 char): Claude drafts
- Keywords (100 char): immigration,USCIS,EOIR,green card,citizenship,divorce,family law,small claims,California,LDA
- Support URL: https://imverica.com/lda
- Marketing URL: https://imverica.com
- Privacy policy URL: https://imverica.com/terms#privacy
- Screenshots: 6.7" iPhone (1290×2796) — at least 3
- App preview videos: optional but boost conversion
- Category: Productivity (primary), Reference (secondary)
- Age rating: 4+

### Google Play
- App name (30 char): "Imverica Legal Solutions"
- Short description (80 char): "California LDA — USCIS, family, civil document preparation"
- Full description (4000 char): Claude drafts
- Screenshots: phone (1080×1920) — at least 4
- Feature graphic: 1024×500
- App icon: 512×512 (already generated)
- Category: Productivity → Document management

## Phase 8 — Privacy + compliance **[CLAUDE + REVIEW]**

- **Privacy nutrition labels** (Apple): mark data collected (email, name,
  uploaded documents), purpose (App Functionality), linked to user (yes).
- **Data safety form** (Google): same disclosures translated to Play
  format.
- **App Tracking Transparency** (iOS 14.5+): we do NOT track — no
  third-party analytics, no ads. Declare so in privacy labels.
- **Compliance with US export law**: declare uses non-exempt
  encryption = NO (we use only standard HTTPS/AES).
- **California UPL safe-harbor**: app description must include "We are
  not a law firm and do not provide legal advice" — Claude already
  in copy.
- **GDPR / CCPA** disclosures: already in https://imverica.com/terms,
  link from app metadata.

## Phase 9 — Production push from backend **[CLAUDE]**

Wire `prepare-doc.js`, `admin-order.js`, `messages.js` to fan out push
via Firebase Admin SDK when:
- A document is prepared and added to the cabinet → push to client
- An order status changes (Received → In review → Prepared → Ready) → push to client
- A new staff message arrives → push to client

`pushTokens` on user profile is already collected by `push-register` handler.

## Phase 10 — Release **[USER decides timing]**

When confident from internal testing:
- iOS: TestFlight → External testing (up to 10,000 testers, requires beta review)
  → submit for App Store review → approval typically 24–48 hours → release.
- Android: Internal → Closed → Open → Production. Each step ~3–7 day review.

---

## Useful CLI cheatsheet

```bash
# Sync web changes into native projects
cd mobile && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx cap sync

# Open iOS in Xcode
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx cap open ios

# Open Android in Android Studio
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx cap open android

# Quick iOS simulator build & install (no Xcode UI)
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=iPhone 17,OS=26.5" \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.imverica.app

# Quick Android debug APK
cd android && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  && export ANDROID_HOME=~/Library/Android/sdk \
  && ./gradlew assembleDebug

# Production AAB for Play Store
./gradlew bundleRelease   # outputs app-release.aab
```
