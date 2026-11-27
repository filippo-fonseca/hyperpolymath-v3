import WidgetKit
import SwiftUI
import AppIntents
import HyperpolymathKit
import HyperpolymathUI

/// The day at a glance: the ring, what's left, and tasks you can tick right
/// on the home screen. Lock screen sizes show a gauge and the next task.
struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.today, provider: SummaryProvider()) { entry in
            TodayWidgetView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
                .widgetURL(URL(string: "hyperpolymath://today"))
        }
        .configurationDisplayName("Today")
        .description("Your day ring and tasks. Tick tasks without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct TodayWidgetView: View {
    let entry: SummaryEntry
    @Environment(\.widgetFamily) private var family

    private var s: Summary { entry.summary }

    var body: some View {
        if entry.state == .signedOut && family != .accessoryInline && family != .accessoryCircular && family != .accessoryRectangular {
            SignedOutView()
        } else {
            switch family {
            case .systemSmall: small
            case .systemMedium: medium
            case .systemLarge: large
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            default: small
            }
        }
    }

    // MARK: Home screen

    private func ring(_ size: CGFloat) -> some View {
        StaticDayRing(tasks: s.taskFraction, habits: s.habitFraction, size: size) {
            Text("\(Int((s.dayFraction * 100).rounded()))%")
                .font(HP.number(size * 0.22, weight: .bold))
                .foregroundStyle(HP.ink)
                .contentTransition(.numericText(value: s.dayFraction))
                .minimumScaleFactor(0.6)
        }
    }

    private var dateLine: some View {
        Text(HPDate.longDay(s.today).uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(HP.ink3)
            .lineLimit(1)
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                ring(66)
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 0) {
                    Text("\(s.counts.todayOpen)")
                        .font(HP.number(30, weight: .bold))
                        .foregroundStyle(HP.ink)
                        .contentTransition(.numericText(value: Double(s.counts.todayOpen)))
                    Text("left")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(HP.ink3)
                }
            }
            Spacer(minLength: 0)
            if let next = s.tasks.today.first(where: { !$0.isDone }) {
                Text(next.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HP.ink)
                    .lineLimit(2)
                if let due = HPDate.dueLabel(date: next.dueDate, time: next.dueTime, today: s.today) {
                    Text(due)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(next.overdue ? HP.danger : HP.ink3)
                }
            } else {
                Label("All clear", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HP.success)
            }
        }
    }

    private var medium: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                dateLine
                ring(84)
                HStack(spacing: 10) {
                    mini(s.counts.doneToday, "done", HP.success)
                    mini(s.habitsDoneToday, "habits", HP.accent)
                }
            }
            .frame(width: 110, alignment: .leading)
            taskList(limit: 4)
        }
    }

    private var large: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                ring(78)
                VStack(alignment: .leading, spacing: 3) {
                    dateLine
                    Text(Greeting.now(timezone: s.timezone, at: entry.date))
                        .font(HP.display(22))
                        .foregroundStyle(HP.ink)
                    Text(Greeting.subtitle(for: s))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(HP.ink2)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            Divider().overlay(HP.hairline)
            taskList(limit: 5)
            if !s.habitsToday.isEmpty {
                Divider().overlay(HP.hairline)
                HStack(spacing: 0) {
                    ForEach(s.habitsToday.prefix(5)) { habit in
                        Button(intent: LogHabitIntent(habitID: habit.id, progress: habit.isDone ? 0 : 3)) {
                            VStack(spacing: 4) {
                                HabitRing(progress: habit.progress, icon: habit.icon, name: habit.name, size: 38)
                                Text(habit.name)
                                    .font(.system(size: 9.5, weight: .semibold))
                                    .foregroundStyle(HP.ink2)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                        .invalidatableContent()
                    }
                }
            }
        }
    }

    private func mini(_ n: Int, _ label: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(n)")
                .font(HP.number(17, weight: .bold))
                .foregroundStyle(tint)
                .contentTransition(.numericText(value: Double(n)))
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(HP.ink3)
        }
    }

    @ViewBuilder
    private func taskList(limit: Int) -> some View {
        let open = s.tasks.today.filter { !$0.isDone }
        if open.isEmpty {
            VStack(spacing: 6) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(HP.success)
                Text(s.counts.doneToday > 0 ? "All clear for today" : "Nothing due today")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HP.ink)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(alignment: .leading, spacing: 7) {
                ForEach(open.prefix(limit)) { task in
                    HStack(spacing: 9) {
                        Button(intent: CompleteTaskIntent(taskID: task.id)) {
                            CheckCircle(isOn: false, tint: task.priority > 0 ? HP.priority(task.priority) : HP.accent, size: 19)
                        }
                        .buttonStyle(.plain)
                        .invalidatableContent()
                        .accessibilityLabel("Complete \(task.title)")
                        VStack(alignment: .leading, spacing: 1) {
                            Text(task.title)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(HP.ink)
                                .lineLimit(1)
                            if task.overdue || task.dueTime != nil {
                                Text(HPDate.dueLabel(date: task.dueDate, time: task.dueTime, today: s.today) ?? "")
                                    .font(.system(size: 10.5, weight: .medium))
                                    .foregroundStyle(task.overdue ? HP.danger : HP.ink3)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .transition(.push(from: .bottom))
                }
                if open.count > limit {
                    Text("+\(open.count - limit) more")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(HP.ink3)
                        .padding(.leading, 28)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: Lock screen

    private var circular: some View {
        Gauge(value: s.dayFraction) {
            Image(systemName: "checklist")
        } currentValueLabel: {
            Text("\(s.counts.todayOpen)")
                .font(HP.number(16, weight: .bold))
        }
        .gaugeStyle(.accessoryCircular)
        .widgetAccentable()
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "checklist")
                Text("\(s.counts.todayOpen) left · \(s.counts.doneToday) done")
            }
            .font(.system(size: 12, weight: .semibold))
            .widgetAccentable()
            if let next = s.tasks.today.first(where: { !$0.isDone }) {
                Text(next.title)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
            } else {
                Text("All clear").font(.system(size: 14, weight: .semibold))
            }
            if let event = s.nextEvent(after: entry.date), let start = event.startDate {
                Text("\(event.title) at \(HPDate.clock(start, timezone: s.timezone))")
                    .font(.system(size: 12))
                    .lineLimit(1)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        Text("\(Image(systemName: "checkmark.circle")) \(s.counts.todayOpen) left · \(s.habitsDoneToday)/\(s.habitsToday.count) habits")
    }
}

#Preview("Medium", as: .systemMedium) {
    TodayWidget()
} timeline: {
    SummaryEntry.placeholder
}
