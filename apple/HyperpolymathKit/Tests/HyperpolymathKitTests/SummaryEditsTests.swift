import XCTest
@testable import HyperpolymathKit

final class SummaryEditsTests: XCTestCase {
    func load() throws -> Summary {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "summary", withExtension: "json", subdirectory: "Fixtures"))
        return try APIClient.decoder.decode(Summary.self, from: Data(contentsOf: url))
    }

    func testCompletingMovesTheCounts() throws {
        var s = try load()
        let overdue = s.tasks.today[0]
        s.markDone(taskID: overdue.id)
        XCTAssertTrue(s.tasks.today[0].isDone)
        XCTAssertEqual(s.counts.todayOpen, 1)
        XCTAssertEqual(s.counts.overdue, 0)
        XCTAssertEqual(s.counts.doneToday, 4)
        XCTAssertEqual(s.activity.last?.tasksDone, 4)
        // Doing it twice changes nothing.
        s.markDone(taskID: overdue.id)
        XCTAssertEqual(s.counts.doneToday, 4)
        s.markOpen(taskID: overdue.id)
        XCTAssertEqual(s.counts.todayOpen, 2)
        XCTAssertEqual(s.counts.overdue, 1)
        XCTAssertEqual(s.counts.doneToday, 3)
    }

    func testRecurringTaskRollsIntoUpcoming() throws {
        var s = try load()
        var stretch = s.tasks.today[1]
        s.markDone(taskID: stretch.id)
        stretch.status = .todo
        stretch.dueDate = "2026-11-28"
        s.settle(task: stretch)
        XCTAssertFalse(s.tasks.today.contains { $0.id == stretch.id })
        XCTAssertEqual(s.tasks.upcoming.first?.id, stretch.id)
        XCTAssertEqual(s.counts.upcoming, 2)
    }

    func testSweepAndInsert() throws {
        var s = try load()
        s.markDone(taskID: s.tasks.today[0].id)
        s.sweepDone()
        XCTAssertEqual(s.tasks.today.count, 1)
        s.insert(task: TaskItem(id: "n", title: "New", dueDate: "2026-11-27"))
        XCTAssertEqual(s.tasks.today.first?.id, "n")
        s.insert(task: TaskItem(id: "i", title: "Someday"))
        XCTAssertEqual(s.counts.inbox, 5)
    }

    func testHabitProgressAndStreak() throws {
        var s = try load()
        let swim = s.habits[0]
        XCTAssertEqual(swim.nextProgress, 3)
        s.setHabit(id: swim.id, progress: 3)
        XCTAssertTrue(s.habits[0].isDone)
        XCTAssertEqual(s.habits[0].streak, 13)
        XCTAssertEqual(s.habits[0].week.last { $0.date == s.today }?.progress, 3)
        XCTAssertEqual(s.activity.last?.habitsDone, 1)
        s.setHabit(id: swim.id, progress: 0)
        XCTAssertEqual(s.habits[0].streak, 12)
        XCTAssertEqual(s.habits[0].nextProgress, 1)
    }

    func testCaptures() throws {
        var s = try load()
        s.insert(capture: Capture(id: "new", content: "Idea", createdAt: "2026-11-27T14:00:00Z"))
        XCTAssertEqual(s.captures.recent.first?.id, "new")
        s.markSeen(captureID: s.captures.resurfaced[0].id)
        XCTAssertTrue(s.captures.resurfaced.isEmpty)
        XCTAssertEqual(s.counts.resurfaced, 0)
    }
}
