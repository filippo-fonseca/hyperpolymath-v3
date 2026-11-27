import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Where the apps connect and with which key. The key is an app-scoped
/// `hpm_` token made in Settings, Phone and Mac.
public struct ServerConfig: Codable, Hashable, Sendable {
    public var server: URL
    public var token: String

    public init(server: URL, token: String) {
        self.server = server
        self.token = token
    }

    /// "hyperpolymath.example.com"
    public var host: String { server.host ?? server.absoluteString }
}

public enum APIError: Error, LocalizedError, Equatable {
    case unauthorized
    case notFound(String)
    case server(status: Int, message: String)
    case offline
    case transport(String)
    case decoding(String)

    public var errorDescription: String? {
        switch self {
        case .unauthorized: return "This device was disconnected. Pair it again from Settings, Phone and Mac."
        case let .notFound(m): return m
        case let .server(_, m): return m
        case .offline: return "You're offline. Showing your last snapshot."
        case let .transport(m): return m
        case let .decoding(m): return "The server answered in a shape this app doesn't know (\(m)). Update the app or the server."
        }
    }

    /// A failure worth showing as a gentle banner rather than an alarm.
    public var isQuiet: Bool { self == .offline }
}

/// The network seam, so tests can answer requests without a server.
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionTransport: HTTPTransport {
    public let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        try await withCheckedThrowingContinuation { cont in
            let task = session.dataTask(with: request) { data, response, error in
                if let error {
                    let ns = error as NSError
                    let offline = ns.domain == NSURLErrorDomain && [
                        NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost,
                        NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost, NSURLErrorTimedOut,
                    ].contains(ns.code)
                    cont.resume(throwing: offline ? APIError.offline : APIError.transport(error.localizedDescription))
                    return
                }
                guard let http = response as? HTTPURLResponse else {
                    cont.resume(throwing: APIError.transport("No response"))
                    return
                }
                cont.resume(returning: (data ?? Data(), http))
            }
            task.resume()
        }
    }
}

/// Talks to /api/v1. Stateless and cheap to make; build one per config.
public struct APIClient: Sendable {
    public let config: ServerConfig
    let transport: HTTPTransport
    let timeout: TimeInterval

    public init(config: ServerConfig, transport: HTTPTransport = URLSessionTransport(), timeout: TimeInterval = 20) {
        self.config = config
        self.transport = transport
        self.timeout = timeout
    }

    public static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    // MARK: Endpoints

    public func me() async throws -> Me {
        try await request("GET", "me")
    }

    public func summary() async throws -> Summary {
        try await request("GET", "summary")
    }

    public enum TaskScope: String, Sendable, CaseIterable {
        case today, upcoming, inbox, open, done
    }

    public func tasks(_ scope: TaskScope, limit: Int = 100) async throws -> [TaskItem] {
        try await request("GET", "tasks", query: ["scope": scope.rawValue, "limit": String(limit)])
    }

    /// Quick add: "Call the bank tomorrow 5pm p1 #Admin".
    public func createTask(text: String) async throws -> TaskItem {
        try await request("POST", "tasks", body: ["text": AnyEncodable(text)])
    }

    public func completeTask(id: String) async throws -> TaskItem {
        try await request("POST", "tasks/\(id)/complete")
    }

    public func reopenTask(id: String) async throws -> TaskItem {
        try await request("POST", "tasks/\(id)/reopen")
    }

    public func logHabit(id: String, progress: Int) async throws -> Habit? {
        try await request("POST", "habits/\(id)/log", body: ["progress": AnyEncodable(progress)])
    }

    public func captures(limit: Int = 30) async throws -> [Capture] {
        try await request("GET", "captures", query: ["limit": String(limit)])
    }

    public func createCapture(content: String) async throws -> Capture {
        try await request("POST", "captures", body: ["content": AnyEncodable(content)])
    }

    public func markCaptureSeen(id: String) async throws {
        let _: SeenResponse = try await request("POST", "captures/\(id)/seen")
    }

    private struct SeenResponse: Decodable { let id: String }
    private struct ErrorBody: Decodable { let error: String }

    // MARK: Plumbing

    func makeRequest(_ method: String, _ path: String, query: [String: String] = [:], body: [String: AnyEncodable]? = nil) throws -> URLRequest {
        var url = config.server.appendingPathComponent("api/v1").appendingPathComponent(path)
        if !query.isEmpty, var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            parts.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
            url = parts.url ?? url
        }
        var req = URLRequest(url: url, timeoutInterval: timeout)
        req.httpMethod = method
        req.setValue("Bearer \(config.token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try Self.encoder.encode(body)
        }
        return req
    }

    private func request<T: Decodable>(_ method: String, _ path: String, query: [String: String] = [:], body: [String: AnyEncodable]? = nil) async throws -> T {
        let req = try makeRequest(method, path, query: query, body: body)
        let (data, http) = try await transport.send(req)
        switch http.statusCode {
        case 200..<300:
            do {
                return try Self.decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(String(describing: error).prefix(160).description)
            }
        case 401, 403:
            throw APIError.unauthorized
        default:
            let message = (try? Self.decoder.decode(ErrorBody.self, from: data))?.error ?? "Server error (\(http.statusCode))"
            if http.statusCode == 404 { throw APIError.notFound(message) }
            throw APIError.server(status: http.statusCode, message: message)
        }
    }
}

/// A tiny type eraser so request bodies can mix strings and numbers.
public struct AnyEncodable: Encodable, Sendable, ExpressibleByStringLiteral, ExpressibleByIntegerLiteral {
    private let encodeValue: @Sendable (Encoder) throws -> Void

    public init<T: Encodable & Sendable>(_ value: T) {
        encodeValue = { try value.encode(to: $0) }
    }

    public init(stringLiteral value: String) { self.init(value) }
    public init(integerLiteral value: Int) { self.init(value) }

    public func encode(to encoder: Encoder) throws { try encodeValue(encoder) }
}
