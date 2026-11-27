import SwiftUI
import HyperpolymathKit

/// Which tab is showing and which sheet is up, driven by taps and deep links.
@MainActor
@Observable
final class Router {
    enum Tab: Hashable { case today, tasks, captures }
    enum Composer: String, Identifiable {
        case task, capture
        var id: String { rawValue }
    }

    var tab: Tab = .today
    var composer: Composer?
    var showSettings = false
    /// A pairing link that arrived while already connected, waiting for a yes.
    var pendingPairing: ServerConfig?
    /// A pairing link for onboarding to connect with.
    var incomingPairing: ServerConfig?

    func open(_ url: URL) {
        guard let route = Pairing.route(url) else { return }
        handle(route)
    }

    func handle(_ route: Pairing.Route) {
        switch route {
        case .connect(let config): incomingPairing = config
        case .today: tab = .today
        case .tasks: tab = .tasks
        case .captures: tab = .captures
        case .capture:
            tab = .captures
            composer = .capture
        }
    }

    /// Pick up a route an intent left while the app was in the background.
    func takePending() {
        if PendingRoute.take() == "capture" { handle(.capture) }
    }
}
