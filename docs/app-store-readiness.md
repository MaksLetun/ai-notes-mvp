# App Store Readiness

## Goal

Prepare AI Memory for distribution on both macOS and iPhone while keeping one product logic and a device-adaptive interface.

## Official Apple Requirements To Track

- Apple Developer Program membership is required for App Store distribution. Current Apple source lists 99 USD per membership year, with regional variation.
- App Store Connect app record must be created before uploading builds. A multi-platform app can be created as one app record with platform-specific metadata.
- App Review requires the app to be complete, stable, tested on device, and free of placeholder content.
- The app must be more than a repackaged website. It needs app-like utility, native-feeling UI, and meaningful functionality.
- iOS and macOS apps require a Privacy Policy URL in App Store Connect.
- App privacy details must disclose collected data types and data use.
- macOS App Store apps must use App Sandbox.
- TestFlight can be used for iOS and macOS beta testing before App Review.
- Human Interface Guidelines should guide layout, platform conventions, Dynamic Type, accessibility, and adaptive behavior.

## Sources

- Apple Developer Program: https://developer.apple.com/programs/enroll/
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App Store Connect, add a new app: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/
- App information: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- App privacy: https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy
- TestFlight: https://developer.apple.com/testflight/
- App Sandbox: https://developer.apple.com/documentation/security/app-sandbox
- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Layout guidance: https://developer.apple.com/design/human-interface-guidelines/layout

## Product Implications For AI Memory

### Must Be App-Like

The current web MVP is useful, but App Store submission should not feel like a plain website in a wrapper. We should add:

- native-feeling navigation;
- polished empty/loading/error states;
- app icon and launch screen;
- local-first data behavior;
- device-specific layout for Mac and iPhone;
- stable offline-capable core note workflows;
- real settings, privacy, import/export, and account states.

### macOS Requirements

For Mac App Store:

- use App Sandbox;
- request only necessary entitlements;
- support resizable windows;
- preserve sidebar layout for desktop;
- use keyboard-friendly interactions;
- add command palette shortcuts later;
- avoid hidden network/API behavior;
- ensure OpenRouter key is never stored in the app bundle.

Recommended future packaging options:

- Tauri for a lightweight macOS app once the web UI stabilizes;
- Electron if we need faster desktop ecosystem support;
- SwiftUI native shell if we want the strongest App Store-native path.

### iPhone Requirements

For iPhone:

- use touch-first layout;
- avoid desktop sidebar as the primary navigation;
- use bottom or compact navigation;
- respect safe areas;
- keep buttons large enough for touch;
- support Dynamic Type-like scaling where possible;
- make note capture the fastest path;
- test on small and large iPhone sizes.

Recommended future packaging options:

- SwiftUI app for best native fit;
- Capacitor-style WKWebView shell only if the UI remains highly app-like and native-feeling.

## Store Submission Checklist

- Apple Developer Program account.
- App Store Connect app record.
- Bundle ID.
- App name, subtitle, category, SKU.
- Privacy Policy URL.
- App privacy data answers.
- Support URL.
- Marketing URL if needed.
- App icon for all required sizes.
- Screenshots for iPhone and macOS.
- Review notes and demo account/demo mode if login exists.
- TestFlight internal testing.
- TestFlight external testing if needed.
- Production backend enabled for review.
- No placeholder text or broken controls.
- On-device QA for iPhone and Mac.
- Accessibility QA.
- Network failure QA.
- Local data/privacy QA.

## Current MVP Gaps Before App Store

- Needs true mobile navigation instead of only responsive sidebar.
- Needs native shell decision: SwiftUI, Tauri, Electron, or Capacitor.
- Needs privacy policy.
- Needs app icon and visual identity.
- Needs screenshots and App Store metadata.
- Needs real persistence/sync architecture.
- Needs AI/data processing disclosure.
- Needs stronger accessibility and keyboard/touch QA.
- Needs device-specific testing on real/simulated iPhone and macOS.
