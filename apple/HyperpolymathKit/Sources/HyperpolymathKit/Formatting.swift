import Foundation

/// Date helpers. The server speaks local calendar dates ("2026-11-27") in the
/// account's timezone and ISO instants; these turn them into words.
public enum HPDate {
    private static func isoFormatter(fractional: Bool) -> ISO8601DateFormatter {
        let f = ISO8601DateFormatter()
        f.formatOptions = fractional ? [.withInternetDateTime, .withFractionalSeconds] : [.withInternetDateTime]
        return f
    }

    /// Parse an ISO instant with or without fractional seconds.
    public static func instant(_ s: String) -> Date? {
        isoFormatter(fractional: true).date(from: s) ?? isoFormatter(fractional: false).date(from: s)
    }

    public static func calendar(_ timezone: String) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: timezone) ?? .current
        return cal
    }

    /// "2026-11-27" -> components, nil when malformed.
    public static func parts(_ local: String) -> (year: Int, month: Int, day: Int)? {
        let bits = local.split(separator: "-").compactMap { Int($0) }
        guard bits.count == 3 else { return nil }
        return (bits[0], bits[1], bits[2])
    }

    /// Noon on a local date, so weekday math never trips over DST.
    public static func date(_ local: String, timezone: String) -> Date? {
        guard let p = parts(local) else { return nil }
        return calendar(timezone).date(from: DateComponents(year: p.year, month: p.month, day: p.day, hour: 12))
    }

    /// Whole days from `a` to `b` (both local dates).
    public static func daysBetween(_ a: String, _ b: String) -> Int? {
        guard let da = date(a, timezone: "UTC"), let db = date(b, timezone: "UTC") else { return nil }
        return calendar("UTC").dateComponents([.day], from: da, to: db).day
    }

    public static func addDays(_ local: String, _ n: Int) -> String {
        guard let d = date(local, timezone: "UTC"), let moved = calendar("UTC").date(byAdding: .day, value: n, to: d) else { return local }
        return localString(moved, timezone: "UTC")
    }

    public static func localString(_ date: Date, timezone: String) -> String {
        let c = calendar(timezone).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private static func format(_ date: Date, _ template: String, timezone: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: timezone) ?? .current
        f.dateFormat = template
        return f.string(from: date)
    }

    /// "Friday, November 27"
    public static func longDay(_ local: String) -> String {
        guard let d = date(local, timezone: "UTC") else { return local }
        return format(d, "EEEE, MMMM d", timezone: "UTC")
    }

    /// "Fri"
    public static func shortWeekday(_ local: String) -> String {
        guard let d = date(local, timezone: "UTC") else { return "" }
        return format(d, "EEE", timezone: "UTC")
    }

    /// "F"
    public static func weekdayLetter(_ local: String) -> String {
        String(shortWeekday(local).prefix(1))
    }

    /// "Nov 27"
    public static func shortDay(_ local: String) -> String {
        guard let d = date(local, timezone: "UTC") else { return local }
        return format(d, "MMM d", timezone: "UTC")
    }

    /// "17:30" -> "5:30 PM", "09:00" -> "9 AM".
    public static func clock(_ hhmm: String) -> String {
        let bits = hhmm.split(separator: ":").compactMap { Int($0) }
        guard bits.count >= 2 else { return hhmm }
        let (h, m) = (bits[0], bits[1])
        let suffix = h < 12 ? "AM" : "PM"
        let h12 = h % 12 == 0 ? 12 : h % 12
        return m == 0 ? "\(h12) \(suffix)" : String(format: "%d:%02d %@", h12, m, suffix)
    }

    /// An instant as a clock time in the account's timezone.
    public static func clock(_ instant: Date, timezone: String) -> String {
        clock(format(instant, "HH:mm", timezone: timezone))
    }

    /// "Today", "Tomorrow", "Yesterday", "Wed", "Nov 30", with the time when set.
    public static func dueLabel(date due: String?, time: String?, today: String) -> String? {
        guard let due else { return time.map(clock) }
        let day: String
        switch daysBetween(today, due) {
        case 0: day = "Today"
        case 1: day = "Tomorrow"
        case -1: day = "Yesterday"
        case let n? where n > 1 && n < 7: day = shortWeekday(due)
        default: day = shortDay(due)
        }
        guard let time else { return day }
        return day == "Today" ? clock(time) : "\(day), \(clock(time))"
    }

    /// "now", "4m ago", "3h ago", "2d ago", or a short date.
    public static func relative(_ iso: String, now: Date = Date()) -> String {
        guard let d = instant(iso) else { return "" }
        let s = Int(now.timeIntervalSince(d))
        if s < 45 { return "now" }
        if s < 3600 { return "\(max(1, s / 60))m ago" }
        if s < 86_400 { return "\(s / 3600)h ago" }
        if s < 7 * 86_400 { return "\(s / 86_400)d ago" }
        return format(d, "MMM d", timezone: TimeZone.current.identifier)
    }

    /// "in 25 min", "in 2 h", "now" for a start time.
    public static func countdown(to start: Date, now: Date = Date()) -> String {
        let m = Int((start.timeIntervalSince(now) / 60).rounded(.up))
        if m <= 0 { return "now" }
        if m < 60 { return "in \(m) min" }
        let h = m / 60, r = m % 60
        return r == 0 || h >= 3 ? "in \(h) h" : "in \(h) h \(r) min"
    }
}

/// Words for the time of day.
public enum Greeting {
    public static func forHour(_ hour: Int) -> String {
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Still up"
        }
    }

    public static func now(timezone: String, at date: Date = Date()) -> String {
        forHour(HPDate.calendar(timezone).component(.hour, from: date))
    }

    /// A short line under the greeting that reacts to how the day is going.
    public static func subtitle(for s: Summary) -> String {
        let open = s.counts.todayOpen
        let habitsLeft = s.habitsToday.count - s.habitsDoneToday
        if open == 0 && habitsLeft == 0 {
            return s.counts.doneToday > 0 ? "Everything's done. Enjoy the rest of your day." : "A clear day. Nothing due."
        }
        var bits: [String] = []
        if open > 0 { bits.append(open == 1 ? "1 task left" : "\(open) tasks left") }
        if habitsLeft > 0 { bits.append(habitsLeft == 1 ? "1 habit to go" : "\(habitsLeft) habits to go") }
        if s.counts.overdue > 0 { bits.append("\(s.counts.overdue) overdue") }
        return bits.joined(separator: " · ")
    }
}
