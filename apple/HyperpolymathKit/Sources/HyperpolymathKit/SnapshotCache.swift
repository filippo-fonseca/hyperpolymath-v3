import Foundation

/// The last good summary on disk, in the app group container so widgets and
/// the app read the same snapshot. Shown instantly on launch and offline.
public struct SnapshotCache: Sendable {
    public struct Snapshot: Codable, Sendable {
        public var summary: Summary
        public var savedAt: Date
    }

    let url: URL

    public init(directory: URL) {
        url = directory.appendingPathComponent("summary.json")
    }

    /// The app group container when there is one, else Application Support.
    public static func standard() -> SnapshotCache {
        #if canImport(Darwin)
        if let group = AppGroup.identifier,
           let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) {
            return SnapshotCache(directory: dir)
        }
        #endif
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let dir = base.appendingPathComponent("Hyperpolymath", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return SnapshotCache(directory: dir)
    }

    public func load() -> Snapshot? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return try? d.decode(Snapshot.self, from: data)
    }

    public func save(_ summary: Summary, at date: Date = Date()) {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        guard let data = try? e.encode(Snapshot(summary: summary, savedAt: date)) else { return }
        try? data.write(to: url, options: .atomic)
    }

    public func clear() {
        try? FileManager.default.removeItem(at: url)
    }
}
