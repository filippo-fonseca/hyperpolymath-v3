import Foundation
import WidgetKit
import HyperpolymathKit

/// What widgets and App Intents do without the app open: read the key from
/// the shared keychain, change the shared snapshot at once (so the widget
/// redraws with the tap already applied), then tell the server. A failure
/// puts the snapshot back and throws, so the system shows the error.
enum WidgetActions {
    enum Failure: Error, LocalizedError {
        case signedOut
        var errorDescription: String? { "Open Hyperpolymath to connect this device first." }
    }

    static func client() throws -> APIClient {
        guard let config = Credentials.standard().load() else { throw Failure.signedOut }
        return APIClient(config: config, timeout: 12)
    }

    /// Apply `change` to the cached snapshot and return the previous one.
    @discardableResult
    static func editSnapshot(_ change: (inout Summary) -> Void) -> SnapshotCache.Snapshot? {
        let cache = SnapshotCache.standard()
        guard let before = cache.load() else { return nil }
        var summary = before.summary
        change(&summary)
        cache.save(summary, at: before.savedAt)
        return before
    }

    static func restore(_ snapshot: SnapshotCache.Snapshot?) {
        guard let snapshot else { return }
        SnapshotCache.standard().save(snapshot.summary, at: snapshot.savedAt)
    }

    static func complete(taskID: String) async throws {
        let api = try client()
        let before = editSnapshot { $0.markDone(taskID: taskID); $0.sweepDone() }
        do {
            _ = try await api.completeTask(id: taskID)
        } catch {
            restore(before)
            throw error
        }
    }

    static func logHabit(id: String, progress: Int) async throws {
        let api = try client()
        let before = editSnapshot { $0.setHabit(id: id, progress: progress) }
        do {
            _ = try await api.logHabit(id: id, progress: progress)
        } catch {
            restore(before)
            throw error
        }
    }

    static func capture(_ text: String) async throws {
        let created = try await client().createCapture(content: text)
        editSnapshot { $0.insert(capture: created) }
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func addTask(_ text: String) async throws -> TaskItem {
        let created = try await client().createTask(text: text)
        editSnapshot { $0.insert(task: created) }
        WidgetCenter.shared.reloadAllTimelines()
        return created
    }
}

/// A route for the app to open next time it comes forward, left by an
/// intent that runs outside it (the Control Center button, Shortcuts).
enum PendingRoute {
    private static let key = "HPMPendingRoute"
    private static var defaults: UserDefaults { AppGroup.identifier.flatMap(UserDefaults.init(suiteName:)) ?? .standard }

    static func set(_ route: String) { defaults.set(route, forKey: key) }

    static func take() -> String? {
        let value = defaults.string(forKey: key)
        defaults.removeObject(forKey: key)
        return value
    }
}

enum WidgetKind {
    static let today = "HyperpolymathToday"
    static let habits = "HyperpolymathHabits"
    static let agenda = "HyperpolymathAgenda"
    static let capture = "HyperpolymathCapture"
}
