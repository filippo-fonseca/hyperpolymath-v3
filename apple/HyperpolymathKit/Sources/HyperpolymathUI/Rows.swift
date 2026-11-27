#if canImport(SwiftUI)
import SwiftUI
import HyperpolymathKit

/// One task: an animated checkbox, the title (struck through once done) and
/// a quiet line with the due label, project and repeat icon.
public struct TaskRow: View {
    let task: TaskItem
    let today: String
    var compact: Bool
    var onToggle: () -> Void

    public init(task: TaskItem, today: String, compact: Bool = false, onToggle: @escaping () -> Void) {
        self.task = task
        self.today = today
        self.compact = compact
        self.onToggle = onToggle
    }

    private var due: String? { HPDate.dueLabel(date: task.dueDate, time: task.dueTime, today: today) }

    public var body: some View {
        HStack(alignment: compact ? .center : .top, spacing: 12) {
            Button(action: onToggle) {
                CheckCircle(isOn: task.isDone, tint: task.priority > 0 ? HP.priority(task.priority) : HP.accent, size: compact ? 20 : 23)
                    .padding(4)
                    .contentShape(Circle())
            }
            .buttonStyle(.pressable)
            .accessibilityLabel(task.isDone ? "Mark \(task.title) not done" : "Complete \(task.title)")

            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .font(.system(size: compact ? 14 : 15.5, weight: .medium))
                    .foregroundStyle(task.isDone ? HP.ink3 : HP.ink)
                    .strikethrough(task.isDone, color: HP.ink3)
                    .lineLimit(compact ? 1 : 2)
                    .animation(HP.spring, value: task.isDone)
                if !compact, due != nil || task.project != nil || task.recurring {
                    HStack(spacing: 6) {
                        if let due {
                            Label(due, systemImage: task.overdue ? "exclamationmark.circle.fill" : "calendar")
                                .labelStyle(TightLabel())
                                .foregroundStyle(task.overdue && !task.isDone ? HP.danger : HP.ink3)
                        }
                        if let project = task.project {
                            Text("#\(project)").foregroundStyle(HP.ink3)
                        }
                        if task.recurring {
                            Image(systemName: "repeat").foregroundStyle(HP.ink3)
                        }
                    }
                    .font(.system(size: 12.5, weight: .medium))
                }
            }
            .padding(.top, compact ? 0 : 5)
            Spacer(minLength: 0)
            if task.priority >= 2 && !task.isDone && !compact {
                Image(systemName: "flag.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(HP.priority(task.priority))
                    .padding(.top, 9)
            }
        }
        .padding(.vertical, compact ? 4 : 7)
        .contentShape(Rectangle())
    }
}

/// Icon and title with a tight gap.
public struct TightLabel: LabelStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 3) {
            configuration.icon
            configuration.title
        }
    }
}

/// The next event, with a live countdown and a colored edge.
public struct EventRow: View {
    let event: CalendarEvent
    let timezone: String
    let now: Date

    public init(event: CalendarEvent, timezone: String, now: Date) {
        self.event = event
        self.timezone = timezone
        self.now = now
    }

    public var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(Color(hexString: event.color) ?? HP.accent)
                .frame(width: 4)
            VStack(alignment: .leading, spacing: 3) {
                Text(event.title)
                    .font(.system(size: 15.5, weight: .semibold))
                    .foregroundStyle(HP.ink)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let start = event.startDate, let end = event.endDate {
                        Text("\(HPDate.clock(start, timezone: timezone)) to \(HPDate.clock(end, timezone: timezone))")
                    } else {
                        Text("All day")
                    }
                    if let location = event.location, !location.isEmpty {
                        Text("·")
                        Text(location).lineLimit(1)
                    }
                }
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(HP.ink3)
            }
            Spacer(minLength: 8)
            if let start = event.startDate {
                let live = start <= now
                Text(live ? "Now" : HPDate.countdown(to: start, now: now))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(live ? Color.white : HP.accent)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(live ? HP.accent : HP.accentSoft))
                    .contentTransition(.numericText())
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// A capture as a soft note card.
public struct CaptureCard: View {
    let capture: Capture
    var resurfaced: Bool
    var onSeen: (() -> Void)?

    public init(capture: Capture, resurfaced: Bool = false, onSeen: (() -> Void)? = nil) {
        self.capture = capture
        self.resurfaced = resurfaced
        self.onSeen = onSeen
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(capture.content)
                .font(.system(size: 15))
                .foregroundStyle(HP.ink)
                .lineLimit(6)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 6) {
                if resurfaced {
                    Label("Back again", systemImage: "sparkles")
                        .labelStyle(TightLabel())
                        .foregroundStyle(HP.violet)
                } else {
                    Text(capture.source == "you" ? "You" : capture.source)
                }
                Text("·")
                Text(HPDate.relative(capture.resurfacedAt ?? capture.createdAt))
                if capture.replies > 0 {
                    Label("\(capture.replies)", systemImage: "bubble.left")
                        .labelStyle(TightLabel())
                }
                Spacer()
                if let onSeen {
                    Button("Seen", action: onSeen)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(HP.violet)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(HP.violet.opacity(0.12)))
                        .buttonStyle(.pressable)
                }
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(HP.ink3)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(resurfaced ? HP.violet.opacity(0.07) : HP.surfaceRaised)
        )
    }
}

/// A big number over a small label, for the stat strip.
public struct StatTile: View {
    let value: Int
    let label: String
    var tint: Color

    public init(value: Int, label: String, tint: Color = HP.ink) {
        self.value = value
        self.label = label
        self.tint = tint
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(value)")
                .font(HP.number(24, weight: .bold))
                .foregroundStyle(tint)
                .contentTransition(.numericText(value: Double(value)))
                .animation(HP.spring, value: value)
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(HP.ink3)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }
}
#endif
