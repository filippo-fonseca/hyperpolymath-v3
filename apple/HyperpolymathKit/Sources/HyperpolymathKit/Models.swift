import Foundation

// The app API's shapes, decoded with `.convertFromSnakeCase`. They mirror the
// zod schemas in src/lib/app-api.ts field for field; the shared fixture in
// Tests/HyperpolymathKitTests/Fixtures keeps the two sides honest.

public enum APIVersion {
    public static let current = 1
}

public enum TaskStatus: String, Codable, Sendable, Hashable {
    case todo, doing, done

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = TaskStatus(rawValue: raw) ?? .todo
    }
}

public struct TaskItem: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var title: String
    public var notes: String?
    public var status: TaskStatus
    /// 0 (none) to 3 (P1).
    public var priority: Int
    /// "YYYY-MM-DD" in the account's timezone.
    public var dueDate: String?
    /// "HH:MM", 24h.
    public var dueTime: String?
    public var overdue: Bool
    public var project: String?
    public var recurring: Bool

    public init(
        id: String, title: String, notes: String? = nil, status: TaskStatus = .todo, priority: Int = 0,
        dueDate: String? = nil, dueTime: String? = nil, overdue: Bool = false, project: String? = nil, recurring: Bool = false
    ) {
        self.id = id
        self.title = title
        self.notes = notes
        self.status = status
        self.priority = priority
        self.dueDate = dueDate
        self.dueTime = dueTime
        self.overdue = overdue
        self.project = project
        self.recurring = recurring
    }

    public var isDone: Bool { status == .done }
}

public struct HabitDay: Codable, Hashable, Sendable {
    public var date: String
    public var progress: Int
    public var scheduled: Bool

    public init(date: String, progress: Int, scheduled: Bool) {
        self.date = date
        self.progress = progress
        self.scheduled = scheduled
    }
}

public struct Habit: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var icon: String?
    public var scheduledToday: Bool
    /// 0 none, 1 started, 2 almost, 3 done.
    public var progress: Int
    public var streak: Int
    /// This calendar week, Sunday first.
    public var week: [HabitDay]

    public init(id: String, name: String, icon: String? = nil, scheduledToday: Bool = true, progress: Int = 0, streak: Int = 0, week: [HabitDay] = []) {
        self.id = id
        self.name = name
        self.icon = icon
        self.scheduledToday = scheduledToday
        self.progress = progress
        self.streak = streak
        self.week = week
    }

    public var isDone: Bool { progress >= 3 }
    /// Progress as 0...1.
    public var fraction: Double { Double(max(0, min(3, progress))) / 3 }
    /// The next state a tap moves to: up one step, wrapping from done to none.
    public var nextProgress: Int { progress >= 3 ? 0 : progress + 1 }
}

public struct Capture: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var content: String
    public var source: String
    public var createdAt: String
    public var replies: Int
    public var resurfacedAt: String?

    public init(id: String, content: String, source: String = "app", createdAt: String, replies: Int = 0, resurfacedAt: String? = nil) {
        self.id = id
        self.content = content
        self.source = source
        self.createdAt = createdAt
        self.replies = replies
        self.resurfacedAt = resurfacedAt
    }
}

public struct CalendarEvent: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var title: String
    /// ISO instant, or "YYYY-MM-DD" when `allDay`.
    public var start: String
    public var end: String
    public var allDay: Bool
    public var location: String?
    public var color: String?

    public init(id: String, title: String, start: String, end: String, allDay: Bool = false, location: String? = nil, color: String? = nil) {
        self.id = id
        self.title = title
        self.start = start
        self.end = end
        self.allDay = allDay
        self.location = location
        self.color = color
    }

    public var startDate: Date? { allDay ? nil : HPDate.instant(start) }
    public var endDate: Date? { allDay ? nil : HPDate.instant(end) }
}

public struct ActivityDay: Codable, Identifiable, Hashable, Sendable {
    public var date: String
    public var tasksDone: Int
    public var habitsDone: Int
    public var id: String { date }

    public init(date: String, tasksDone: Int, habitsDone: Int) {
        self.date = date
        self.tasksDone = tasksDone
        self.habitsDone = habitsDone
    }
}

public struct Summary: Codable, Hashable, Sendable {
    public struct Profile: Codable, Hashable, Sendable {
        public var name: String?
        public var avatarUrl: String?
        public init(name: String? = nil, avatarUrl: String? = nil) {
            self.name = name
            self.avatarUrl = avatarUrl
        }
    }

    public struct Counts: Codable, Hashable, Sendable {
        public var todayOpen: Int
        public var overdue: Int
        public var inbox: Int
        public var upcoming: Int
        public var doneToday: Int
        public var resurfaced: Int
        public init(todayOpen: Int = 0, overdue: Int = 0, inbox: Int = 0, upcoming: Int = 0, doneToday: Int = 0, resurfaced: Int = 0) {
            self.todayOpen = todayOpen
            self.overdue = overdue
            self.inbox = inbox
            self.upcoming = upcoming
            self.doneToday = doneToday
            self.resurfaced = resurfaced
        }
    }

    public struct Tasks: Codable, Hashable, Sendable {
        public var today: [TaskItem]
        public var upcoming: [TaskItem]
        public init(today: [TaskItem] = [], upcoming: [TaskItem] = []) {
            self.today = today
            self.upcoming = upcoming
        }
    }

    public struct Captures: Codable, Hashable, Sendable {
        public var recent: [Capture]
        public var resurfaced: [Capture]
        public init(recent: [Capture] = [], resurfaced: [Capture] = []) {
            self.recent = recent
            self.resurfaced = resurfaced
        }
    }

    public struct Calendar: Codable, Hashable, Sendable {
        public var connected: Bool
        public var error: String?
        public var events: [CalendarEvent]
        public init(connected: Bool = false, error: String? = nil, events: [CalendarEvent] = []) {
            self.connected = connected
            self.error = error
            self.events = events
        }
    }

    public var version: Int
    public var generatedAt: String
    public var timezone: String
    public var today: String
    public var profile: Profile
    public var counts: Counts
    public var tasks: Tasks
    public var habits: [Habit]
    public var captures: Captures
    public var calendar: Calendar
    /// The last 14 days, oldest first, ending today.
    public var activity: [ActivityDay]

    public init(
        version: Int = APIVersion.current, generatedAt: String, timezone: String, today: String, profile: Profile = .init(),
        counts: Counts = .init(), tasks: Tasks = .init(), habits: [Habit] = [], captures: Captures = .init(),
        calendar: Calendar = .init(), activity: [ActivityDay] = []
    ) {
        self.version = version
        self.generatedAt = generatedAt
        self.timezone = timezone
        self.today = today
        self.profile = profile
        self.counts = counts
        self.tasks = tasks
        self.habits = habits
        self.captures = captures
        self.calendar = calendar
        self.activity = activity
    }
}

public struct Me: Codable, Hashable, Sendable {
    public struct Token: Codable, Hashable, Sendable {
        public var name: String
        public var scope: String
    }

    public var version: Int
    public var name: String?
    public var avatarUrl: String?
    public var timezone: String
    public var token: Token
}

// MARK: - Derived numbers the UI and widgets share

public extension Summary {
    /// Habits scheduled today.
    var habitsToday: [Habit] { habits.filter(\.scheduledToday) }

    /// Tasks done today over everything on today's plate (done plus still open).
    var taskFraction: Double {
        let total = counts.doneToday + counts.todayOpen
        return total == 0 ? 0 : Double(counts.doneToday) / Double(total)
    }

    /// Average progress of today's habits, partial steps included.
    var habitFraction: Double {
        let list = habitsToday
        guard !list.isEmpty else { return 0 }
        return list.map(\.fraction).reduce(0, +) / Double(list.count)
    }

    /// One number for the whole day: tasks and habit steps, weighted by count.
    var dayFraction: Double {
        let list = habitsToday
        let units = Double(counts.doneToday + counts.todayOpen) + Double(list.count)
        guard units > 0 else { return 0 }
        let done = Double(counts.doneToday) + list.map(\.fraction).reduce(0, +)
        return min(1, done / units)
    }

    var habitsDoneToday: Int { habitsToday.filter(\.isDone).count }

    var bestStreak: Int { habits.map(\.streak).max() ?? 0 }

    /// The next timed event that hasn't ended, given the current time.
    func nextEvent(after now: Date) -> CalendarEvent? {
        calendar.events
            .filter { !$0.allDay && ($0.endDate ?? .distantPast) > now }
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
            .first
    }

    var displayName: String? {
        guard let name = profile.name?.trimmingCharacters(in: .whitespaces), !name.isEmpty else { return nil }
        return name.split(separator: " ").first.map(String.init)
    }
}
