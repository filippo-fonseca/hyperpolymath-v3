# Hyperpolymath for iPhone and Mac

Native apps for your Hyperpolymath dashboard:

- **iPhone app.** Today, Tasks and Captures, with an animated day ring, habit rings you tap to log, two weeks of momentum, quick add that understands "Gym tomorrow 7am p2 #Health", and a capture composer.
- **Home screen and lock screen widgets.** Today (tick tasks without opening the app), Habits (tap a ring to log it), Up next (a live countdown to your next event) and Capture. On iOS 18 there's also a Capture button for Control Center and the lock screen.
- **Siri and Shortcuts.** "Capture in Hyperpolymath", "Add a task in Hyperpolymath".
- **Mac menu bar app.** A small two-track ring and your open count in the menu bar. Click it for today's tasks, habits, the next event, the last two weeks and a capture field (start with `+` to add a task instead).

Everything the apps do goes through the same service layer as the web dashboard and MCP, so each change shows up in the activity log as **you** and can be reverted there.

```
 iPhone app ──┐                    ┌── Today, Habits, Up next, Capture widgets
              │   HyperpolymathKit │   (read the shared snapshot, tap through App Intents)
 Mac menu bar ┤   models, client,  ├─────────────────────────────┐
              │   store, keychain  │                             │
              └────────┬───────────┘                             │
                       │  HTTPS, Authorization: Bearer hpm_… (app scope)
                       ▼                                         ▼
          /api/v1/summary, tasks, habits, captures      App group container
                       │                                 (summary.json + keychain)
                       ▼
          src/server/app-api.ts → services → Supabase (logged, revertible)
```

## What's in this folder

| Path | What it is |
| --- | --- |
| `HyperpolymathKit/` | A Swift package shared by every target. `HyperpolymathKit` is plain Foundation (models, API client, pairing links, keychain, snapshot cache, optimistic edits, the observable `AppStore`) and builds and tests on Linux too. `HyperpolymathUI` is the SwiftUI design system: colors and type matched to the web app, the day ring, habit rings, the drawn checkbox, bursts, the aurora background and the activity chart. |
| `iOS/` | The iPhone and iPad app. |
| `Widgets/` | The WidgetKit extension (widgets and the iOS 18 control). |
| `Shared/` | App Intents and the widget actions, compiled into both the app and the widget extension. |
| `macOS/` | The menu bar app. |
| `project.yml` | The Xcode project, as an [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec. Info.plist and entitlements are generated from it. |

## Build and run

You need a Mac with Xcode 16 or newer (iOS 17 and macOS 14 are the minimums).

```bash
brew install xcodegen
cd apple
xcodegen
open Hyperpolymath.xcodeproj
```

1. In Xcode, pick your team under **Signing & Capabilities** for the `Hyperpolymath`, `HyperpolymathWidgets` and `HyperpolymathMac` targets.
2. If you're not the original author, change `HPM_BUNDLE_PREFIX` and `HPM_APP_GROUP` in `project.yml` to identifiers your team owns (for example `com.yourname.hyperpolymath` and `group.com.yourname.hyperpolymath`), then run `xcodegen` again. The app and the widgets must share that app group, or widgets can't read your key.
3. Run the **Hyperpolymath** scheme on your iPhone (or a simulator), or **HyperpolymathMac** for the menu bar app.

Widgets and the shared keychain need a signed build with the app group capability. An unsigned simulator build still runs, but its widgets fall back to the last snapshot the app saved.

### Run the package tests

```bash
cd apple/HyperpolymathKit
swift test
```

These cover decoding (against the same JSON fixture the server's vitest contract test checks), the API client, pairing links, date words and the optimistic edits. On Linux, run them in Docker: `docker run --rm -v "$PWD":/pkg -w /pkg swift:6.1-noble swift test`.

## Pair a device

1. On the web dashboard, open **Settings → Phone and Mac** and tap **Pair device**. Give it a name like "iPhone" or "MacBook".
2. **iPhone:** point the Camera app at the QR code and tap the banner. Hyperpolymath opens and connects. You can also copy the link and use **Paste** on the welcome screen.
3. **Mac:** copy the link under the code and paste it into the menu bar app, or just click the link on the Mac and the app picks it up.

Each device gets its own **app-scoped key**. It can read your day, tick tasks, log habits, add tasks and capture, but it **can't reach MCP**, so a lost phone can't rewrite your account. Disconnect a device in the same settings page and its key stops working at once. Keys live in the keychain, shared with the widget extension through the app group.

## How it feels

The UI follows the web dashboard's tokens (near-white canvas, ink text, accent `#1084fe`, soft layered shadows, 22 pt continuous corners, the serif monogram) and adds motion that answers every touch:

- Cards rise and sharpen in one after another when the app opens.
- The day ring sweeps in from zero: tasks on the outer track (blue to violet), habits on the inner one (green to teal). Finishing something bursts a ring of dots and plays a success haptic.
- A checkbox blooms and draws its tick, the title strikes through, and a moment later the row folds away.
- Habit rings fill in three steps (started, almost, done). Tap to move a step, touch and hold for every option.
- Counts roll like an odometer, the Tasks picker slides a pill between tabs, and slow aurora light drifts behind the header.
- Reduce Motion turns the drifting and the entrances off.

Every change is optimistic: the screen and the widgets move the moment you tap, the server call follows, and if it fails the change rolls back with a short message.

## The app API

The apps talk to `/api/v1` on your deployment. See [`docs/APP-API.md`](../docs/APP-API.md) for the endpoints and shapes. The shapes are zod schemas in `src/lib/app-api.ts`, and the Swift models in `HyperpolymathKit/Sources/HyperpolymathKit/Models.swift` mirror them field for field.

## Status

The server side (token scopes, `/api/v1`, the pairing UI) and `HyperpolymathKit` are built and tested in CI-like conditions. The SwiftUI targets (app, widgets, menu bar) were written without Xcode available, so they haven't been compiled yet. Expect a few small fixes on the first build in Xcode; please open an issue or PR with anything that trips.
