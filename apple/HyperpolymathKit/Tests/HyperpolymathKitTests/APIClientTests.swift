import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import HyperpolymathKit

/// Answers every request with a canned response and remembers what it saw.
final class StubTransport: HTTPTransport, @unchecked Sendable {
    var status = 200
    var body = Data("{}".utf8)
    private(set) var requests: [URLRequest] = []

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        return (body, HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
    }
}

final class APIClientTests: XCTestCase {
    let config = ServerConfig(server: URL(string: "https://hpm.example.com")!, token: "hpm_test_test_test_test")

    func testSendsTheBearerKeyToTheRightPath() async throws {
        let stub = StubTransport()
        stub.body = try Data(contentsOf: XCTUnwrap(Bundle.module.url(forResource: "summary", withExtension: "json", subdirectory: "Fixtures")))
        let s = try await APIClient(config: config, transport: stub).summary()
        XCTAssertEqual(s.counts.inbox, 4)
        let req = try XCTUnwrap(stub.requests.first)
        XCTAssertEqual(req.url?.absoluteString, "https://hpm.example.com/api/v1/summary")
        XCTAssertEqual(req.httpMethod, "GET")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer hpm_test_test_test_test")
    }

    func testEncodesBodiesAndQueries() async throws {
        let stub = StubTransport()
        stub.body = Data(#"{"id":"c","content":"Hi","source":"you","created_at":"2026-11-27T12:00:00Z","replies":0,"resurfaced_at":null}"#.utf8)
        _ = try await APIClient(config: config, transport: stub).createCapture(content: "Hi")
        let post = try XCTUnwrap(stub.requests.last)
        XCTAssertEqual(post.httpMethod, "POST")
        XCTAssertEqual(post.url?.path, "/api/v1/captures")
        let sent = try JSONSerialization.jsonObject(with: XCTUnwrap(post.httpBody)) as? [String: String]
        XCTAssertEqual(sent, ["content": "Hi"])

        stub.body = Data("[]".utf8)
        _ = try await APIClient(config: config, transport: stub).tasks(.inbox, limit: 5)
        XCTAssertEqual(stub.requests.last?.url?.query, "limit=5&scope=inbox")
    }

    func testMapsErrors() async {
        let stub = StubTransport()
        stub.status = 401
        do {
            _ = try await APIClient(config: config, transport: stub).me()
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
        stub.status = 404
        stub.body = Data(#"{"error":"task x: not found","code":"not_found"}"#.utf8)
        do {
            _ = try await APIClient(config: config, transport: stub).completeTask(id: "x")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound("task x: not found"))
        }
    }
}
