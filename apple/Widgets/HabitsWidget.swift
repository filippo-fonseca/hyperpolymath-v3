import WidgetKit
import SwiftUI
import AppIntents
import HyperpolymathKit
import HyperpolymathUI

/// Habit rings you can tap to log, with streaks.
struct HabitsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.habits, provider: SummaryProvider()) { entry in
            HabitsWidgetView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
                .widgetURL(URL(string: "hyperpolymath://today"))
        }
        .configurationDisplayName("Habits")
        .description("Tap a ring to log today's habit.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

struct HabitsWidgetView: View {
    let entry: SummaryEntry
    @Environment(\.widgetFamily) private var family

    private var habits: [Habit] {
        let today = entry.summary.habitsToday
        return today.isEmpty ? entry.summary.habits : today
    }

    var body: some View {
        if entry.state == .signedOut && family != .accessoryRectangular {
            SignedOutView()
        } else if habits.isEmpty {
            VStack(spacing: 6) {
                Image(systemName: "circle.dotted.circle").font(.system(size: 24)).foregroundStyle(HP.success)
                Text("No habits yet").font(.system(size: 13, weight: .semibold)).foregroundStyle(HP.ink)
            }
        } else {
            switch family {
            case .systemMedium: medium
            case .accessoryRectangular: rectangular
            default: small
            }
        }
    }

    private func cell(_ habit: Habit, size: CGFloat, showName: Bool) -> some View {
        Button(intent: LogHabitIntent(habitID: habit.id, progress: habit.isDone ? 0 : 3)) {
            VStack(spacing: 4) {
                HabitRing(progress: habit.progress, icon: habit.icon, name: habit.name, size: size)
                if showName {
                    Text(habit.name)
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(HP.ink)
                        .lineLimit(1)
                    if habit.streak > 0 {
                        Label("\(habit.streak)", systemImage: "flame.fill")
                            .labelStyle(TightLabel())
                            .font(HP.number(10, weight: .bold))
                            .foregroundStyle(HP.warm)
                            .contentTransition(.numericText(value: Double(habit.streak)))
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .invalidatableContent()
        .accessibilityLabel(habit.isDone ? "Clear \(habit.name)" : "Log \(habit.name)")
    }

    private var small: some View {
        let list = Array(habits.prefix(4))
        return VStack(spacing: 10) {
            HStack(spacing: 10) {
                ForEach(list.prefix(2)) { cell($0, size: 50, showName: false) }
            }
            if list.count > 2 {
                HStack(spacing: 10) {
                    ForEach(list.dropFirst(2)) { cell($0, size: 50, showName: false) }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("HABITS")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(HP.ink3)
                Spacer()
                Text("\(entry.summary.habitsDoneToday) of \(entry.summary.habitsToday.count) today")
                    .font(HP.number(11, weight: .bold))
                    .foregroundStyle(HP.ink2)
            }
            HStack(alignment: .top, spacing: 6) {
                ForEach(habits.prefix(5)) { cell($0, size: 46, showName: true) }
            }
            Spacer(minLength: 0)
        }
    }

    private var rectangular: some View {
        HStack(spacing: 6) {
            ForEach(habits.prefix(4)) { habit in
                Gauge(value: habit.fraction) {
                    Text(habit.icon ?? String(habit.name.prefix(1)))
                }
                .gaugeStyle(.accessoryCircularCapacity)
            }
        }
        .widgetAccentable()
    }
}
