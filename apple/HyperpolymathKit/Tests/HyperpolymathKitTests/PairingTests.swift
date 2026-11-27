import XCTest
@testable import HyperpolymathKit

final class PairingTests: XCTestCase {
    let token = "hpm_AbCdEfGhIjKlMnOpQrStUvWxYz012345"

    func testParsesTheSettingsLink() throws {
        let link = "  hyperpolymath://connect?server=https%3A%2F%2Fhpm.example.com&token=\(token)\n"
        let c = try Pairing.parse(link)
        XCTAssertEqual(c.server.absoluteString, "https://hpm.example.com")
        XCTAssertEqual(c.token, token)
        XCTAssertEqual(c.host, "hpm.example.com")
    }

    func testRejectsOtherLinks() {
        XCTAssertThrowsError(try Pairing.parse("https://example.com")) { XCTAssertEqual($0 as? Pairing.Failure, .notALink) }
        XCTAssertThrowsError(try Pairing.parse("hyperpolymath://connect?token=\(token)")) { XCTAssertEqual($0 as? Pairing.Failure, .missingServer) }
        XCTAssertThrowsError(try Pairing.parse("hyperpolymath://connect?server=https://x.com&token=nope")) { XCTAssertEqual($0 as? Pairing.Failure, .badToken) }
    }

    func testManualEntryNormalisesTheServer() throws {
        XCTAssertEqual(try Pairing.manual(server: "hpm.example.com/", token: token).server.absoluteString, "https://hpm.example.com")
        XCTAssertEqual(try Pairing.manual(server: "http://localhost:3000", token: token).server.absoluteString, "http://localhost:3000")
        XCTAssertThrowsError(try Pairing.manual(server: "http://hpm.example.com", token: token)) { XCTAssertEqual($0 as? Pairing.Failure, .insecureServer) }
    }

    func testRoutes() throws {
        XCTAssertEqual(Pairing.route(URL(string: "hyperpolymath://capture")!), .capture)
        XCTAssertEqual(Pairing.route(URL(string: "hyperpolymath://today")!), .today)
        XCTAssertNil(Pairing.route(URL(string: "https://capture")!))
        if case .connect(let c)? = Pairing.route(URL(string: "hyperpolymath://connect?server=https%3A%2F%2Fa.com&token=\(token)")!) {
            XCTAssertEqual(c.host, "a.com")
        } else {
            XCTFail("expected a connect route")
        }
    }
}
