import XCTest
@testable import HyperpolymathKit

/// Decodes the fixtures that src/lib/app-api.test.ts checks against the
/// server's zod schemas, so both sides agree on every field.
final class DecodingTests: XCTestCase {
    func fixture(_ name: String) throws -> Data {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
        return try Data(contentsOf: url)
    }

    func testSummaryDecodes() throws {
        let s = try APIClient.decoder.decode(Summary.self, from: fixture("summary"))
        XCTAssertEqual(s.version, APIVersion.current)
        XCTAssertEqual(s.today, "2026-11-27")
        XCTAssertEqual(s.counts.todayOpen, 2)
        XCTAssertEqual(s.counts.doneToday, 3)
        XCTAssertEqual(s.tasks.today.first?.overdue, true)
        XCTAssertEqual(s.tasks.today[1].status, .doing)
        XCTAssertEqual(s.tasks.today[1].dueTime, "07:30")
        XCTAssertEqual(s.habits.first?.week.count, 7)
        XCTAssertEqual(s.habits.first?.scheduledToday, true)
        XCTAssertNil(s.habits[1].icon)
        XCTAssertEqual(s.captures.resurfaced.first?.resurfacedAt, "2026-11-27T13:00:00+00:00")
        XCTAssertEqual(s.calendar.events.count, 2)
        XCTAssertTrue(s.calendar.events[1].allDay)
        XCTAssertNotNil(s.calendar.events[0].startDate)
        XCTAssertEqual(s.activity.count, 14)
        XCTAssertEqual(s.activity.last?.date, s.today)
        XCTAssertEqual(s.profile.name, "Ada Lovelace")
        XCTAssertEqual(s.displayName, "Ada")
    }

    func testMeDecodes() throws {
        let me = try APIClient.decoder.decode(Me.self, from: fixture("me"))
        XCTAssertEqual(me.token.scope, "app")
        XCTAssertEqual(me.timezone, "America/New_York")
    }

    func testUnknownStatusFallsBackToTodo() throws {
        let json = #"{"id":"x","title":"t","notes":null,"status":"blocked","priority":0,"due_date":null,"due_time":null,"overdue":false,"project":null,"recurring":false}"#
        let t = try APIClient.decoder.decode(TaskItem.self, from: Data(json.utf8))
        XCTAssertEqual(t.status, .todo)
    }

    func testDerivedNumbers() throws {
        let s = try APIClient.decoder.decode(Summary.self, from: fixture("summary"))
        // 3 done of 5 tasks today.
        XCTAssertEqual(s.taskFraction, 0.6, accuracy: 0.0001)
        // Only Swim is scheduled today, at 2 of 3.
        XCTAssertEqual(s.habitFraction, 2.0 / 3.0, accuracy: 0.0001)
        // (3 tasks + 2/3 habit) over (5 tasks + 1 habit).
        XCTAssertEqual(s.dayFraction, (3 + 2.0 / 3.0) / 6, accuracy: 0.0001)
        XCTAssertEqual(s.bestStreak, 12)
        let beforeLecture = try XCTUnwrap(HPDate.instant("2026-11-27T19:30:00Z"))
        XCTAssertEqual(s.nextEvent(after: beforeLecture)?.title, "Fluid mechanics lecture")
        XCTAssertNil(s.nextEvent(after: beforeLecture.addingTimeInterval(3 * 3600)))
    }

    func testSampleRoundTrips() throws {
        let data = try JSONEncoder().encode(Summary.sample)
        let back = try JSONDecoder().decode(Summary.self, from: data)
        XCTAssertEqual(back, Summary.sample(now: HPDate.instant(back.generatedAt)!))
    }
}
