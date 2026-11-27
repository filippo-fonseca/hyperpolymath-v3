#if canImport(Observation)
import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import HyperpolymathKit

@MainActor
final class AppStoreTests: XCTestCase {
    func temp() -> SnapshotCache {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("hpm-test-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return SnapshotCache(directory: dir)
    }

    func testStartsSignedOutWithoutAKey() {
        let store = AppStore(credentials: MemoryCredentialStore(), cache: temp(), transport: StubTransport())
        XCTAssertEqual(store.phase, .signedOut)
    }

    func testRefreshCachesAndAFailedWriteRollsBack() async throws {
        let stub = StubTransport()
        let fixture = try Data(contentsOf: XCTUnwrap(Bundle.module.url(forResource: "summary", withExtension: "json", subdirectory: "Fixtures")))
        stub.body = fixture
        let cache = temp()
        let creds = MemoryCredentialStore(ServerConfig(server: URL(string: "https://a.com")!, token: "hpm_test_test_test_test"))
        let store = AppStore(credentials: creds, cache: cache, transport: stub)
        XCTAssertEqual(store.phase, .loading)
        await store.refresh()
        XCTAssertEqual(store.phase, .ready)
        XCTAssertEqual(cache.load()?.summary.counts.inbox, 4)

        // A cold start shows the cached snapshot straight away.
        let again = AppStore(credentials: creds, cache: cache, transport: stub)
        XCTAssertEqual(again.phase, .ready)

        stub.status = 500
        stub.body = Data(#"{"error":"boom"}"#.utf8)
        let task = try XCTUnwrap(store.summary?.tasks.today.first)
        await store.toggle(task)
        XCTAssertEqual(store.summary?.tasks.today.first?.isDone, false)
        XCTAssertEqual(store.summary?.counts.doneToday, 3)
        XCTAssertNotNil(store.notice)
    }

    func testUnauthorizedSignsOut() async {
        let stub = StubTransport()
        stub.status = 401
        let store = AppStore(credentials: MemoryCredentialStore(ServerConfig(server: URL(string: "https://a.com")!, token: "hpm_test_test_test_test")), cache: temp(), transport: stub)
        await store.refresh()
        XCTAssertEqual(store.phase, .signedOut)
    }
}
#endif
