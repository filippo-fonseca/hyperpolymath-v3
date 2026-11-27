import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

/// Today: a greeting over drifting aurora light, the day ring, what's next
/// on the calendar, today's tasks, habit rings and two weeks of momentum.
/// Cards rise in one after another; every tap answers at once.
struct HomeView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @State private var scrolled = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    TimelineView(.everyMinute) { context in
                        header(now: context.date)
                    }
                    .appear(0)

                    if let s = store.summary {
                        HeroCard(summary: s).appear(1)
                        if let next = s.nextEvent(after: Date()) {
                            NextUpCard(event: next, timezone: s.timezone).appear(2)
                        }
                        TodayCard(summary: s).appear(3)
                        if !s.habits.isEmpty {
                            HabitsCard(summary: s).appear(4)
                        }
                        if !s.captures.resurfaced.isEmpty {
                            ResurfacedCard(captures: s.captures.resurfaced).appear(5)
                        }
                        MomentumCard(summary: s).appear(6)
                        if let updated = store.lastUpdated {
                            Text("Updated \(updated, style: .relative) ago")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(HP.ink3)
                                .padding(.top, 4)
                        }
                    } else {
                        LoadingCards()
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 110)
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
            }
            .background(alignment: .top) {
                ZStack(alignment: .top) {
                    HP.canvas
                    AuroraBackground().frame(height: 460)
                }
                .ignoresSafeArea()
            }
            .refreshable { await store.refresh() }
            .overlay(alignment: .bottomTrailing) {
                AddButton { router.composer = .task }
                    .padding(20)
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func header(now: Date) -> some View {
        let s = store.summary
        let tz = s?.timezone ?? TimeZone.current.identifier
        let greeting = Greeting.now(timezone: tz, at: now)
        return HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text(HPDate.longDay(s?.today ?? HPDate.localString(now, timezone: tz)).uppercased())
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(HP.ink3)
                Group {
                    if let name = s?.displayName {
                        Text("\(greeting),\n\(Text(name).foregroundStyle(HP.accent))")
                    } else {
                        Text(greeting)
                    }
                }
                .font(HP.display(34))
                .foregroundStyle(HP.ink)
                .lineSpacing(-2)
                .contentTransition(.opacity)
                if let s {
                    Text(Greeting.subtitle(for: s))
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(HP.ink2)
                        .contentTransition(.numericText())
                        .animation(HP.spring, value: Greeting.subtitle(for: s))
                }
            }
            Spacer()
            Button { router.showSettings = true } label: {
                Avatar(url: s?.profile.avatarUrl, name: s?.profile.name, size: 42)
            }
            .buttonStyle(.pressable)
            .accessibilityLabel("Settings")
        }
        .padding(.top, 12)
        .padding(.horizontal, 4)
    }
}

// MARK: - Hero

private struct HeroCard: View {
    let summary: Summary
    @Environment(AppStore.self) private var store

    var body: some View {
        let s = summary
        let percent = Int((s.dayFraction * 100).rounded())
        VStack(spacing: 16) {
            HStack(spacing: 20) {
                ZStack {
                    DayRing(tasks: s.taskFraction, habits: s.habitFraction, size: 138) {
                        VStack(spacing: 0) {
                            Text("\(percent)%")
                                .font(HP.number(30, weight: .bold))
                                .foregroundStyle(HP.ink)
                                .contentTransition(.numericText(value: Double(percent)))
                                .animation(HP.spring, value: percent)
                            Text("of today")
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundStyle(HP.ink3)
                        }
                    }
                    Burst(trigger: store.celebration, color: HP.accent, count: 14, radius: 84)
                }
                VStack(alignment: .leading, spacing: 14) {
                    StatTile(value: s.counts.doneToday, label: "Done today", tint: HP.success)
                    StatTile(value: s.counts.todayOpen, label: s.counts.overdue > 0 ? "Left, \(s.counts.overdue) overdue" : "Left today")
                    HStack(spacing: 4) {
                        StatTile(value: s.bestStreak, label: "Best streak", tint: HP.warm)
                        Image(systemName: "flame.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(HP.warm)
                            .symbolEffect(.bounce, value: s.bestStreak)
                            .offset(y: -8)
                    }
                }
                Spacer(minLength: 0)
            }
            if percent >= 100 {
                Label("A perfect day. Everything's done.", systemImage: "sparkles")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(HP.success)
                    .symbolEffect(.pulse, options: .repeating)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(HP.success.opacity(0.12)))
                    .transition(.scale(scale: 0.8).combined(with: .opacity))
            }
        }
        .hpCard(padding: 20)
        .animation(HP.spring, value: percent >= 100)
    }
}

// MARK: - Next up

private struct NextUpCard: View {
    let event: CalendarEvent
    let timezone: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader("Next up", symbol: "calendar", tint: HP.accent)
            TimelineView(.everyMinute) { context in
                EventRow(event: event, timezone: timezone, now: context.date)
            }
        }
        .hpCard()
    }
}

// MARK: - Today's tasks

private struct TodayCard: View {
    let summary: Summary
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    private let limit = 6

    var body: some View {
        let tasks = summary.tasks.today
        VStack(alignment: .leading, spacing: 8) {
            CardHeader("Today", symbol: "sun.max.fill", tint: HP.warm) {
                if summary.counts.todayOpen > 0 {
                    Text("\(summary.counts.todayOpen)")
                        .font(HP.number(12, weight: .bold))
                        .foregroundStyle(HP.ink2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(HP.fill))
                        .contentTransition(.numericText(value: Double(summary.counts.todayOpen)))
                }
            }
            if tasks.isEmpty {
                EmptyState(
                    symbol: summary.counts.doneToday > 0 ? "checkmark.seal.fill" : "sun.horizon.fill",
                    title: summary.counts.doneToday > 0 ? "All clear" : "Nothing due",
                    message: summary.counts.doneToday > 0 ? "\(summary.counts.doneToday) done today. Nicely handled." : "Add something, or enjoy the space.",
                    tint: summary.counts.doneToday > 0 ? HP.success : HP.warm
                )
                .transition(.scale(scale: 0.9).combined(with: .opacity))
            } else {
                VStack(spacing: 0) {
                    ForEach(tasks.prefix(limit)) { task in
                        TaskRow(task: task, today: summary.today) { toggle(task) }
                            .transition(.asymmetric(
                                insertion: .move(edge: .top).combined(with: .opacity),
                                removal: .opacity.combined(with: .scale(scale: 0.92, anchor: .leading))
                            ))
                        if task.id != tasks.prefix(limit).last?.id {
                            Divider().overlay(HP.hairline).padding(.leading, 43)
                        }
                    }
                }
                if tasks.count > limit {
                    Button { router.tab = .tasks } label: {
                        HStack(spacing: 4) {
                            Text("See all \(tasks.count)")
                            Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold))
                        }
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(HP.accent)
                    }
                    .buttonStyle(.pressable)
                    .padding(.top, 4)
                }
            }
        }
        .hpCard()
        .animation(HP.spring, value: tasks)
    }

    private func toggle(_ task: TaskItem) {
        Task {
            let ok = await store.toggle(task)
            guard ok, !task.isDone else { return }
            // Let the check draw and the title strike through, then tidy up.
            try? await Task.sleep(for: .milliseconds(850))
            withAnimation(HP.spring) { store.sweepDone() }
        }
    }
}

// MARK: - Habits

private struct HabitsCard: View {
    let summary: Summary
    @Environment(AppStore.self) private var store
    @State private var bursts: [String: Int] = [:]

    var body: some View {
        let habits = summary.habitsToday.isEmpty ? summary.habits : summary.habitsToday
        VStack(alignment: .leading, spacing: 14) {
            CardHeader("Habits", symbol: "circle.dotted.circle", tint: HP.success) {
                Text("\(summary.habitsDoneToday) of \(summary.habitsToday.count)")
                    .font(HP.number(12, weight: .bold))
                    .foregroundStyle(HP.ink2)
                    .contentTransition(.numericText(value: Double(summary.habitsDoneToday)))
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 18) {
                    ForEach(habits) { habit in
                        HabitCell(habit: habit, today: summary.today, burst: bursts[habit.id, default: 0])
                            .onTapGesture { set(habit, habit.nextProgress) }
                            .contextMenu {
                                Button { set(habit, 3) } label: { Label("Done", systemImage: "checkmark.circle.fill") }
                                Button { set(habit, 2) } label: { Label("Almost", systemImage: "circle.bottomhalf.filled") }
                                Button { set(habit, 1) } label: { Label("Started", systemImage: "circle.dotted") }
                                Button(role: .destructive) { set(habit, 0) } label: { Label("Clear", systemImage: "xmark.circle") }
                            }
                            .accessibilityAddTraits(.isButton)
                            .accessibilityHint("Tap to move one step. Touch and hold for options.")
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 4)
            }
            .scrollClipDisabled()
            Text("Tap a ring to move it a step. Touch and hold for more.")
                .font(.system(size: 12))
                .foregroundStyle(HP.ink3)
        }
        .hpCard()
    }

    private func set(_ habit: Habit, _ progress: Int) {
        if progress >= 3 && !habit.isDone { bursts[habit.id, default: 0] += 1 }
        Task { await store.setHabit(habit, progress: progress) }
    }
}

private struct HabitCell: View {
    let habit: Habit
    let today: String
    let burst: Int

    var body: some View {
        VStack(spacing: 8) {
            HabitRing(progress: habit.progress, icon: habit.icon, name: habit.name, size: 62, celebrate: burst)
            Text(habit.name)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(HP.ink)
                .lineLimit(1)
                .frame(maxWidth: 74)
            HStack(spacing: 3) {
                ForEach(habit.week, id: \.date) { day in
                    Circle()
                        .fill(day.progress >= 3 ? HP.success : day.progress > 0 ? HP.success.opacity(0.4) : HP.fill)
                        .frame(width: 5, height: 5)
                        .overlay(Circle().strokeBorder(day.date == today ? HP.ink3 : .clear, lineWidth: 0.75).padding(-1.5))
                        .opacity(day.scheduled ? 1 : 0.35)
                }
            }
            if habit.streak > 0 {
                Label("\(habit.streak)", systemImage: "flame.fill")
                    .labelStyle(TightLabel())
                    .font(HP.number(11.5, weight: .bold))
                    .foregroundStyle(HP.warm)
                    .contentTransition(.numericText(value: Double(habit.streak)))
            }
        }
        .contentShape(Rectangle())
        .animation(HP.spring, value: habit.progress)
    }
}

// MARK: - Resurfaced captures

private struct ResurfacedCard: View {
    let captures: [Capture]
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader("Back again", symbol: "sparkles", tint: HP.violet)
            ForEach(captures.prefix(3)) { capture in
                CaptureCard(capture: capture, resurfaced: true) {
                    Task { await store.markSeen(capture) }
                }
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .hpCard()
        .animation(HP.spring, value: captures)
    }
}

// MARK: - Momentum

private struct MomentumCard: View {
    let summary: Summary

    var body: some View {
        let tasks = summary.activity.map(\.tasksDone).reduce(0, +)
        let habits = summary.activity.map(\.habitsDone).reduce(0, +)
        VStack(alignment: .leading, spacing: 14) {
            CardHeader("Last 14 days", symbol: "chart.bar.fill", tint: HP.accent) {
                HStack(spacing: 10) {
                    LegendChip(color: HP.accent, label: "Tasks", value: tasks)
                    LegendChip(color: HP.success, label: "Habits", value: habits)
                }
            }
            ActivityChart(days: summary.activity, today: summary.today, height: 130)
        }
        .hpCard()
    }
}

// MARK: - Pieces

private struct LoadingCards: View {
    var body: some View {
        VStack(spacing: 16) {
            ForEach(0..<3, id: \.self) { i in
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBar(width: 90, height: 10)
                    SkeletonBar(height: 16)
                    SkeletonBar(width: 200, height: 16)
                }
                .hpCard()
                .appear(i + 1)
            }
        }
    }
}

/// The floating plus: a dark circle that springs when pressed.
struct AddButton: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(HP.canvas)
                .frame(width: 58, height: 58)
                .background(Circle().fill(HP.ink))
                .shadow(color: .black.opacity(0.22), radius: 16, y: 8)
        }
        .buttonStyle(PressableStyle(scale: 0.9))
        .accessibilityLabel("Add")
    }
}

/// Your photo, or your initial on a soft accent circle.
struct Avatar: View {
    let url: String?
    let name: String?
    var size: CGFloat

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initial
                }
            } else {
                initial
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(HP.hairline, lineWidth: 1))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 3)
    }

    private var initial: some View {
        Text(String((name ?? "H").prefix(1)).uppercased())
            .font(HP.display(size * 0.45))
            .foregroundStyle(HP.accent)
            .frame(width: size, height: size)
            .background(HP.accentSoft)
    }
}
