import XCTest
@testable import HyperpolymathKit

final class FormattingTests: XCTestCase {
    func testClock() {
        XCTAssertEqual(HPDate.clock("17:30"), "5:30 PM")
        XCTAssertEqual(HPDate.clock("09:00"), "9 AM")
        XCTAssertEqual(HPDate.clock("00:05"), "12:05 AM")
        XCTAssertEqual(HPDate.clock("12:00"), "12 PM")
    }

    func testDueLabels() {
        let today = "2026-11-27" // a Friday
        XCTAssertEqual(HPDate.dueLabel(date: today, time: nil, today: today), "Today")
        XCTAssertEqual(HPDate.dueLabel(date: today, time: "16:00", today: today), "4 PM")
        XCTAssertEqual(HPDate.dueLabel(date: "2026-11-28", time: "09:30", today: today), "Tomorrow, 9:30 AM")
        XCTAssertEqual(HPDate.dueLabel(date: "2026-11-26", time: nil, today: today), "Yesterday")
        XCTAssertEqual(HPDate.dueLabel(date: "2026-11-30", time: nil, today: today), "Mon")
        XCTAssertEqual(HPDate.dueLabel(date: "2026-12-25", time: nil, today: today), "Dec 25")
        XCTAssertNil(HPDate.dueLabel(date: nil, time: nil, today: today))
    }

    func testDayMath() {
        XCTAssertEqual(HPDate.addDays("2026-11-30", 2), "2026-12-02")
        XCTAssertEqual(HPDate.addDays("2027-03-14", -1), "2027-03-13")
        XCTAssertEqual(HPDate.daysBetween("2026-12-31", "2027-01-02"), 2)
        XCTAssertEqual(HPDate.longDay("2026-11-27"), "Friday, November 27")
        XCTAssertEqual(HPDate.weekdayLetter("2026-11-29"), "S")
    }

    func testRelativeAndCountdown() throws {
        let now = try XCTUnwrap(HPDate.instant("2026-11-27T12:00:00Z"))
        XCTAssertEqual(HPDate.relative("2026-11-27T11:59:50Z", now: now), "now")
        XCTAssertEqual(HPDate.relative("2026-11-27T11:30:00.250Z", now: now), "29m ago")
        XCTAssertEqual(HPDate.relative("2026-11-27T09:00:00Z", now: now), "3h ago")
        XCTAssertEqual(HPDate.countdown(to: now.addingTimeInterval(25 * 60), now: now), "in 25 min")
        XCTAssertEqual(HPDate.countdown(to: now.addingTimeInterval(90 * 60), now: now), "in 1 h 30 min")
        XCTAssertEqual(HPDate.countdown(to: now.addingTimeInterval(-60), now: now), "now")
    }

    func testGreeting() {
        XCTAssertEqual(Greeting.forHour(7), "Good morning")
        XCTAssertEqual(Greeting.forHour(13), "Good afternoon")
        XCTAssertEqual(Greeting.forHour(20), "Good evening")
        XCTAssertEqual(Greeting.forHour(2), "Still up")
        XCTAssertEqual(Greeting.subtitle(for: .sampleEmpty), "A clear day. Nothing due.")
    }
}
