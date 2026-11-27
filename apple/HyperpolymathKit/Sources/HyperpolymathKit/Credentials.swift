import Foundation
#if canImport(Security)
import Security
#endif

/// Where the device's server address and key live. On Apple platforms that's
/// the keychain, shared with the widget extension through the app group; the
/// in-memory store backs tests and Linux builds.
public protocol CredentialStore: Sendable {
    func load() -> ServerConfig?
    func save(_ config: ServerConfig) throws
    func clear()
}

public final class MemoryCredentialStore: CredentialStore, @unchecked Sendable {
    private var value: ServerConfig?
    private let lock = NSLock()

    public init(_ value: ServerConfig? = nil) {
        self.value = value
    }

    public func load() -> ServerConfig? { lock.withLock { value } }
    public func save(_ config: ServerConfig) throws { lock.withLock { value = config } }
    public func clear() { lock.withLock { value = nil } }
}

/// The app group shared by the app and its widgets, read from Info.plist
/// (`HPMAppGroup`) so a fork only changes it in project.yml.
public enum AppGroup {
    public static var identifier: String? {
        let id = Bundle.main.object(forInfoDictionaryKey: "HPMAppGroup") as? String
        return (id?.isEmpty ?? true) ? nil : id
    }
}

#if canImport(Security)
public struct KeychainCredentialStore: CredentialStore {
    let service: String
    let account = "server-config"
    let accessGroup: String?

    public init(service: String = "Hyperpolymath", accessGroup: String? = AppGroup.identifier) {
        self.service = service
        self.accessGroup = accessGroup
    }

    /// Places to look, best first: the shared group, the app's own default,
    /// and on macOS the legacy file keychain for unsigned local builds.
    private var locations: [(group: String?, modern: Bool)] {
        var out: [(group: String?, modern: Bool)] = []
        if let accessGroup { out.append((group: accessGroup, modern: true)) }
        out.append((group: nil, modern: true))
        #if os(macOS)
        out.append((group: nil, modern: false))
        #endif
        return out
    }

    private func query(group: String?, modern: Bool) -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        #if os(macOS)
        if modern { q[kSecUseDataProtectionKeychain as String] = true }
        #endif
        if let group { q[kSecAttrAccessGroup as String] = group }
        return q
    }

    public func load() -> ServerConfig? {
        for loc in locations {
            var q = query(group: loc.group, modern: loc.modern)
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            var out: CFTypeRef?
            if SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data,
               let config = try? JSONDecoder().decode(ServerConfig.self, from: data) {
                return config
            }
        }
        return nil
    }

    public func save(_ config: ServerConfig) throws {
        let data = try JSONEncoder().encode(config)
        clear()
        var status: OSStatus = errSecParam
        // Builds without the app group entitlement (or unsigned Mac builds)
        // fall through to the next location; widgets then use the cache.
        for loc in locations {
            var q = query(group: loc.group, modern: loc.modern)
            q[kSecValueData as String] = data
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            status = SecItemAdd(q as CFDictionary, nil)
            if status == errSecSuccess { return }
        }
        throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Couldn't save the key to the keychain (\(status))."])
    }

    public func clear() {
        for loc in locations { SecItemDelete(query(group: loc.group, modern: loc.modern) as CFDictionary) }
    }
}
#endif

public enum Credentials {
    /// The platform's real store.
    public static func standard() -> CredentialStore {
        #if canImport(Security)
        return KeychainCredentialStore()
        #else
        return MemoryCredentialStore()
        #endif
    }
}
