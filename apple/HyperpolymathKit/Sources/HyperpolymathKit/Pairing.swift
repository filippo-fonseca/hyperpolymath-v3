import Foundation

/// Reads the pairing link Settings, Phone and Mac shows as a QR code:
/// `hyperpolymath://connect?server=https%3A%2F%2Fexample.com&token=hpm_...`
public enum Pairing {
    public static let scheme = "hyperpolymath"

    public enum Failure: Error, LocalizedError, Equatable {
        case notALink, missingServer, insecureServer, badToken

        public var errorDescription: String? {
            switch self {
            case .notALink: return "That isn't a Hyperpolymath pairing link. Copy it from Settings, Phone and Mac."
            case .missingServer: return "The link has no server address."
            case .insecureServer: return "The server must use https (http only works for localhost)."
            case .badToken: return "The link's key looks wrong. Keys start with hpm_."
            }
        }
    }

    /// Parse a pasted or scanned link. Surrounding whitespace is fine.
    public static func parse(_ text: String) throws -> ServerConfig {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parts = URLComponents(string: trimmed), parts.scheme?.lowercased() == scheme, parts.host == "connect" else {
            throw Failure.notALink
        }
        let items = parts.queryItems ?? []
        let value = { (name: String) in items.first { $0.name == name }?.value?.trimmingCharacters(in: .whitespaces) }
        guard let server = value("server"), !server.isEmpty else { throw Failure.missingServer }
        let config = try manual(server: server, token: value("token") ?? "")
        return config
    }

    /// Build a config from a typed server address and key.
    public static func manual(server raw: String, token rawToken: String) throws -> ServerConfig {
        var server = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !server.contains("://") { server = "https://" + server }
        while server.hasSuffix("/") { server.removeLast() }
        guard let url = URL(string: server), let host = url.host, !host.isEmpty else { throw Failure.missingServer }
        let local = host == "localhost" || host == "127.0.0.1" || host.hasSuffix(".local")
        guard url.scheme == "https" || (url.scheme == "http" && local) else { throw Failure.insecureServer }
        let token = rawToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard token.hasPrefix("hpm_"), token.count >= 20, !token.contains(" ") else { throw Failure.badToken }
        return ServerConfig(server: url, token: token)
    }

    /// Deep links the apps handle besides pairing.
    public enum Route: Equatable, Sendable {
        case connect(ServerConfig)
        case today
        case tasks
        case capture
        case captures
    }

    public static func route(_ url: URL) -> Route? {
        guard url.scheme?.lowercased() == scheme else { return nil }
        switch url.host {
        case "connect": return (try? parse(url.absoluteString)).map(Route.connect)
        case "today": return .today
        case "tasks": return .tasks
        case "capture": return .capture
        case "captures": return .captures
        default: return nil
        }
    }
}
