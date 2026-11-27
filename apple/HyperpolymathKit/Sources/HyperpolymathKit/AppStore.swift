import Foundation
#if canImport(Observation)
import Observation

/// The one source of state for the iPhone app and the Mac menu bar app.
/// Reads come from the cached snapshot first (instant launch, offline), then
/// the server. Writes are optimistic: the summary changes at once, the server
/// call follows, and a failure rolls the change back with a message.
@MainActor
@Observable
public final class AppStore {
    public enum Phase: Equatable {
        /// No device key yet: show onboarding.
        case signedOut
        /// Connected, nothing to show yet.
        case loading
        /// We have a summary (maybe a cached one).
        case ready
    }

    public private(set) var phase: Phase
    public private(set) var summary: Summary?
    public private(set) var config: ServerConfig?
    public private(set) var me: Me?
    public private(set) var lastUpdated: Date?
    public private(set) var isRefreshing = false
    /// A message for a banner; the view clears it.
    public var notice: Notice?
    /// Bumps when a task completes or a habit finishes, for haptics and celebrations.
    public private(set) var celebration = 0

    public struct Notice: Equatable, Identifiable {
        public let id = UUID()
        public var text: String
        public var quiet: Bool
    }

    /// Called after every change that widgets should reflect.
    public var onSnapshotChange: (() -> Void)?

    private let credentials: CredentialStore
    private let cache: SnapshotCache
    private let transport: HTTPTransport
    private var inFlight: Set<String> = []

    public init(credentials: CredentialStore = Credentials.standard(), cache: SnapshotCache = .standard(), transport: HTTPTransport = URLSessionTransport()) {
        self.credentials = credentials
        self.cache = cache
        self.transport = transport
        let config = credentials.load()
        self.config = config
        if let config, config.token.isEmpty == false, let snap = cache.load() {
            summary = snap.summary
            lastUpdated = snap.savedAt
            phase = .ready
        } else {
            phase = config == nil ? .signedOut : .loading
        }
    }

    private var client: APIClient? { config.map { APIClient(config: $0, transport: transport) } }

    // MARK: Connection

    /// Check the key against the server, then keep it.
    public func connect(_ config: ServerConfig) async throws {
        let client = APIClient(config: config, transport: transport)
        let me = try await client.me()
        try credentials.save(config)
        self.config = config
        self.me = me
        phase = summary == nil ? .loading : .ready
        await refresh()
    }

    public func disconnect() {
        credentials.clear()
        cache.clear()
        config = nil
        me = nil
        summary = nil
        lastUpdated = nil
        phase = .signedOut
        onSnapshotChange?()
    }

    // MARK: Reads

    public func refresh() async {
        guard let client, !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let fresh = try await client.summary()
            apply(fresh, save: true)
            lastUpdated = Date()
            phase = .ready
            if me == nil { me = try? await client.me() }
        } catch let error as APIError {
            if error == .unauthorized {
                disconnect()
                notice = Notice(text: error.localizedDescription, quiet: false)
                return
            }
            notice = Notice(text: error.localizedDescription, quiet: error.isQuiet || summary != nil)
            if summary == nil { phase = .loading }
        } catch {
            notice = Notice(text: error.localizedDescription, quiet: summary != nil)
        }
    }

    /// Refresh only when the snapshot is older than `age` seconds.
    public func refreshIfStale(olderThan age: TimeInterval = 60) async {
        if let lastUpdated, Date().timeIntervalSince(lastUpdated) < age { return }
        await refresh()
    }

    private func apply(_ s: Summary, save: Bool) {
        summary = s
        if save { cache.save(s) }
        onSnapshotChange?()
    }

    private func edit(_ change: (inout Summary) -> Void) {
        guard var s = summary else { return }
        change(&s)
        apply(s, save: true)
    }

    // MARK: Writes

    public func toggle(_ task: TaskItem) async {
        guard let client, !inFlight.contains(task.id) else { return }
        inFlight.insert(task.id)
        defer { inFlight.remove(task.id) }
        let completing = !task.isDone
        edit { s in if completing { s.markDone(taskID: task.id) } else { s.markOpen(taskID: task.id) } }
        if completing { celebration += 1 }
        do {
            let result = completing ? try await client.completeTask(id: task.id) : try await client.reopenTask(id: task.id)
            edit { $0.settle(task: result) }
        } catch {
            edit { s in if completing { s.markOpen(taskID: task.id) } else { s.markDone(taskID: task.id) } }
            report(error, doing: completing ? "complete that task" : "reopen that task")
        }
    }

    /// Remove finished rows once their check animation has played.
    public func sweepDone() {
        edit { $0.sweepDone() }
    }

    public func setHabit(_ habit: Habit, progress: Int) async {
        guard let client else { return }
        let before = habit.progress
        edit { $0.setHabit(id: habit.id, progress: progress) }
        if progress >= 3 && before < 3 { celebration += 1 }
        do {
            if let fresh = try await client.logHabit(id: habit.id, progress: progress) { edit { $0.replace(habit: fresh) } }
        } catch {
            edit { $0.setHabit(id: habit.id, progress: before) }
            report(error, doing: "log \(habit.name)")
        }
    }

    /// Quick add. Returns the created task, or nil on failure (with a notice).
    @discardableResult
    public func addTask(_ text: String) async -> TaskItem? {
        guard let client else { return nil }
        do {
            let task = try await client.createTask(text: text)
            edit { $0.insert(task: task) }
            return task
        } catch {
            report(error, doing: "add that task")
            return nil
        }
    }

    @discardableResult
    public func capture(_ text: String) async -> Capture? {
        guard let client else { return nil }
        do {
            let c = try await client.createCapture(content: text)
            edit { $0.insert(capture: c) }
            return c
        } catch {
            report(error, doing: "save that capture")
            return nil
        }
    }

    public func markSeen(_ capture: Capture) async {
        guard let client else { return }
        let before = summary
        edit { $0.markSeen(captureID: capture.id) }
        do {
            try await client.markCaptureSeen(id: capture.id)
        } catch {
            if let before { apply(before, save: true) }
            report(error, doing: "clear that capture")
        }
    }

    /// Fetch a task list beyond what the summary carries (inbox, all open).
    public func tasks(_ scope: APIClient.TaskScope) async -> [TaskItem]? {
        guard let client else { return nil }
        do {
            return try await client.tasks(scope)
        } catch {
            report(error, doing: "load tasks")
            return nil
        }
    }

    public func allCaptures() async -> [Capture]? {
        guard let client else { return nil }
        do {
            return try await client.captures(limit: 100)
        } catch {
            report(error, doing: "load captures")
            return nil
        }
    }

    private func report(_ error: Error, doing what: String) {
        if let api = error as? APIError, api == .unauthorized {
            disconnect()
            notice = Notice(text: api.localizedDescription, quiet: false)
            return
        }
        let reason = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        notice = Notice(text: "Couldn't \(what). \(reason)", quiet: false)
    }

    // MARK: Previews

    /// A store filled with sample data, for SwiftUI previews and screenshots.
    public static func preview(_ summary: Summary = .sample) -> AppStore {
        let store = AppStore(credentials: MemoryCredentialStore(.init(server: URL(string: "https://example.com")!, token: "hpm_preview_preview_preview")), cache: SnapshotCache(directory: FileManager.default.temporaryDirectory.appendingPathComponent("hpm-preview-\(UUID().uuidString)")))
        store.summary = summary
        store.phase = .ready
        store.lastUpdated = Date()
        return store
    }
}
#endif
