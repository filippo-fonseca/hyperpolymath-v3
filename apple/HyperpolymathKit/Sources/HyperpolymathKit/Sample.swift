import Foundation

/// Made-up data for SwiftUI previews, widget placeholders and screenshots.
/// Dates are relative to now, so previews always look like today.
public extension Summary {
    static var sample: Summary { sample(now: Date()) }

    static func sample(now: Date, timezone: String = TimeZone.current.identifier) -> Summary {
        let today = HPDate.localString(now, timezone: timezone)
        let day = { (n: Int) in HPDate.addDays(today, n) }
        let iso = { (minutes: Double) in ISO8601DateFormatter().string(from: now.addingTimeInterval(minutes * 60)) }
        let weekStart = day(-(HPDate.calendar("UTC").component(.weekday, from: HPDate.date(today, timezone: "UTC") ?? now) - 1))
        let week = { (done: [Int]) in
            (0..<7).map { i -> HabitDay in
                let d = HPDate.addDays(weekStart, i)
                return HabitDay(date: d, progress: d < today ? done[i % done.count] : (d == today ? 1 : 0), scheduled: true)
            }
        }
        return Summary(
            generatedAt: iso(0),
            timezone: timezone,
            today: today,
            profile: .init(name: "Ada Lovelace", avatarUrl: nil),
            counts: .init(todayOpen: 4, overdue: 1, inbox: 6, upcoming: 3, doneToday: 3, resurfaced: 1),
            tasks: .init(
                today: [
                    TaskItem(id: "t1", title: "Send the lab report draft", priority: 3, dueDate: day(-1), overdue: true, project: "Thermo"),
                    TaskItem(id: "t2", title: "Problem set 7, questions 3 to 5", priority: 2, dueDate: today, dueTime: "16:00", project: "Signals"),
                    TaskItem(id: "t3", title: "Call the bike shop about the wheel", dueDate: today),
                    TaskItem(id: "t4", title: "Stretch for 15 minutes", dueDate: today, recurring: true),
                ],
                upcoming: [
                    TaskItem(id: "t5", title: "Book flights home", priority: 1, dueDate: day(1)),
                    TaskItem(id: "t6", title: "Read chapter 9", dueDate: day(2), project: "Physiology"),
                    TaskItem(id: "t7", title: "Team sync notes", dueDate: day(4), dueTime: "10:00", project: "Lab"),
                ]
            ),
            habits: [
                Habit(id: "h1", name: "Swim", icon: "🏊", progress: 3, streak: 12, week: week([3, 3, 0, 3])),
                Habit(id: "h2", name: "Read", icon: "📖", progress: 2, streak: 5, week: week([3, 2, 3])),
                Habit(id: "h3", name: "Meditate", icon: "🧘", progress: 0, streak: 0, week: week([0, 3, 1])),
                Habit(id: "h4", name: "Water", icon: "💧", progress: 1, streak: 21, week: week([3])),
            ],
            captures: .init(
                recent: [
                    Capture(id: "c1", content: "Heart rate variability as an input for adaptive training plans?", source: "you", createdAt: iso(-25)),
                    Capture(id: "c2", content: "Look into the Windkessel model for the fluids project", source: "Kiwi", createdAt: iso(-180), replies: 2),
                ],
                resurfaced: [
                    Capture(id: "c3", content: "Book: The Emperor of All Maladies", source: "you", createdAt: iso(-60 * 24 * 9), resurfacedAt: iso(-90)),
                ]
            ),
            calendar: .init(connected: true, events: [
                CalendarEvent(id: "e1", title: "Fluid mechanics lecture", start: iso(35), end: iso(110), location: "Mason 211"),
                CalendarEvent(id: "e2", title: "Swim practice", start: iso(300), end: iso(390), location: "Payne Whitney"),
            ]),
            activity: (0..<14).map { i in
                let tasks = [2, 4, 1, 5, 3, 0, 2, 6, 3, 4, 2, 5, 4, 3][i]
                let habits = [2, 3, 3, 1, 4, 2, 3, 4, 2, 3, 4, 3, 2, 1][i]
                return ActivityDay(date: day(i - 13), tasksDone: tasks, habitsDone: habits)
            }
        )
    }

    /// A day with nothing on it, for empty states.
    static var sampleEmpty: Summary {
        let now = Date()
        let tz = TimeZone.current.identifier
        return Summary(generatedAt: ISO8601DateFormatter().string(from: now), timezone: tz, today: HPDate.localString(now, timezone: tz))
    }
}
