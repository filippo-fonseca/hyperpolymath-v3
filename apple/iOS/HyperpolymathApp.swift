import SwiftUI
import WidgetKit
import HyperpolymathKit
import HyperpolymathUI

@main
struct HyperpolymathApp: App {
    @State private var store = AppStore()
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(router)
                .onOpenURL { router.open($0) }
                .task { store.onSnapshotChange = { WidgetSync.reloadSoon() } }
        }
    }
}

/// Coalesces widget reloads, so a burst of taps costs one reload.
@MainActor
enum WidgetSync {
    private static var pending: Task<Void, Never>?

    static func reloadSoon() {
        pending?.cancel()
        pending = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
