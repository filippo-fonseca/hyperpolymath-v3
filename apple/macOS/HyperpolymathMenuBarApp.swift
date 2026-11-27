import SwiftUI
import AppKit
import HyperpolymathKit
import HyperpolymathUI

/// The Mac menu bar app: a tiny progress ring and count in the menu bar,
/// and a popover with today's tasks, habit rings, the next event, two weeks
/// of momentum and a capture field. No Dock icon (LSUIElement).
@main
struct HyperpolymathMenuBarApp: App {
    @NSApplicationDelegateAdaptor(MacAppDelegate.self) private var delegate
    @State private var store = MacShared.store

    var body: some Scene {
        MenuBarExtra {
            MenuContentView()
                .environment(store)
        } label: {
            MenuBarLabel(summary: store.summary)
        }
        .menuBarExtraStyle(.window)

        Settings {
            MacSettingsView()
                .environment(store)
        }
    }
}

/// One store for the whole app, so the delegate can refresh and pair
/// whether or not the popover has ever been opened.
@MainActor
enum MacShared {
    static let store = AppStore()
}

final class MacAppDelegate: NSObject, NSApplicationDelegate {
    private var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        Task { @MainActor in await MacShared.store.refresh() }
        // Keep the menu bar count fresh: every 5 minutes while the app runs.
        timer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { _ in
            Task { @MainActor in await MacShared.store.refresh() }
        }
        // And whenever the Mac wakes.
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in await MacShared.store.refresh() }
        }
    }

    /// hyperpolymath://connect links from the web pair this Mac.
    func application(_ application: NSApplication, open urls: [URL]) {
        Task { @MainActor in
            for url in urls {
                if case .connect(let config)? = Pairing.route(url) {
                    try? await MacShared.store.connect(config)
                }
            }
        }
    }
}

/// The menu bar icon: a small two-track ring with the open count beside it.
struct MenuBarLabel: View {
    let summary: Summary?

    var body: some View {
        HStack(spacing: 4) {
            Image(nsImage: MenuBarGlyph.image(tasks: summary?.taskFraction ?? 0, habits: summary?.habitFraction ?? 0))
            if let open = summary?.counts.todayOpen, open > 0 {
                Text("\(open)").monospacedDigit()
            }
        }
    }
}

@MainActor
enum MenuBarGlyph {
    /// Rendered as a template image so it follows the menu bar's light and dark.
    static func image(tasks: Double, habits: Double) -> NSImage {
        let glyph = ZStack {
            Circle().stroke(Color.black.opacity(0.28), lineWidth: 2)
            Circle()
                .trim(from: 0, to: max(0.0001, min(1, tasks)))
                .stroke(Color.black, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Circle()
                .trim(from: 0, to: max(0.0001, min(1, habits)))
                .stroke(Color.black, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .padding(4)
        }
        .padding(1)
        .frame(width: 16, height: 16)

        let renderer = ImageRenderer(content: glyph)
        renderer.scale = NSScreen.main?.backingScaleFactor ?? 2
        let image = renderer.nsImage ?? NSImage(systemSymbolName: "circle.circle", accessibilityDescription: "Hyperpolymath") ?? NSImage()
        image.isTemplate = true
        image.accessibilityDescription = "Hyperpolymath"
        return image
    }
}
