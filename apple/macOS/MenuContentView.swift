import SwiftUI
import AppKit
import HyperpolymathKit
import HyperpolymathUI

struct MenuContentView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        Group {
            switch store.phase {
            case .signedOut:
                MacConnectView()
                    .transition(.opacity.combined(with: .scale(scale: 0.97)))
            case .loading, .ready:
                MacTodayView()
                    .transition(.opacity)
            }
        }
        .frame(width: 380)
        .background(HP.canvas)
        .animation(HP.gentle, value: store.phase)
        .task { await store.refreshIfStale(olderThan: 60) }
    }
}

// MARK: - Connected

struct MacTodayView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openSettings) private var openSettings
    @State private var capture = ""
    @State private var captured = 0
    @State private var bursts: [String: Int] = [:]
    @FocusState private var captureFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            if let s = store.summary {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        header(s).appear(0)
                        tasks(s).appear(1)
                        if !s.habitsToday.isEmpty { habits(s).appear(2) }
                        if let next = s.nextEvent(after: Date()) {
                            TimelineView(.everyMinute) { ctx in
                                EventRow(event: next, timezone: s.timezone, now: ctx.date)
                            }
                            .hpCard(padding: 14)
                            .appear(3)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            CardHeader("Last 14 days", symbol: "chart.bar.fill", tint: HP.accent)
                            ActivityChart(days: s.activity, today: s.today, height: 70)
                        }
                        .hpCard(padding: 14)
                        .appear(4)
                    }
                    .padding(14)
                }
                .frame(maxHeight: 560)
            } else {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading your day…").foregroundStyle(HP.ink3)
                }
                .frame(maxWidth: .infinity, minHeight: 200)
            }
            captureBar
            footer
        }
        .background(alignment: .top) {
            AuroraBackground(intensity: 0.8).frame(height: 220)
        }
        .sensoryFeedback(.success, trigger: store.celebration)
        .overlay(alignment: .top) {
            if let notice = store.notice {
                Text(notice.text)
                    .font(.system(size: 12, weight: .medium))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: Capsule())
                    .padding(8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture { store.notice = nil }
                    .task(id: notice.id) {
                        try? await Task.sleep(for: .seconds(4))
                        if store.notice?.id == notice.id { store.notice = nil }
                    }
            }
        }
        .animation(HP.spring, value: store.notice)
    }

    private func header(_ s: Summary) -> some View {
        HStack(spacing: 14) {
            ZStack {
                DayRing(tasks: s.taskFraction, habits: s.habitFraction, size: 74) {
                    Text("\(Int((s.dayFraction * 100).rounded()))%")
                        .font(HP.number(15, weight: .bold))
                        .contentTransition(.numericText(value: s.dayFraction))
                        .animation(HP.spring, value: s.dayFraction)
                }
                Burst(trigger: store.celebration, color: HP.accent, count: 12, radius: 48)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(HPDate.longDay(s.today).uppercased())
                    .font(.system(size: 10.5, weight: .semibold))
                    .tracking(0.9)
                    .foregroundStyle(HP.ink3)
                Text(s.displayName.map { "\(Greeting.now(timezone: s.timezone)), \($0)" } ?? Greeting.now(timezone: s.timezone))
                    .font(HP.display(21))
                    .foregroundStyle(HP.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(Greeting.subtitle(for: s))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(HP.ink2)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
        .padding(.top, 4)
    }

    private func tasks(_ s: Summary) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            CardHeader("Today", symbol: "sun.max.fill", tint: HP.warm) {
                Text("\(s.counts.todayOpen) left")
                    .font(HP.number(11, weight: .bold))
                    .foregroundStyle(HP.ink3)
                    .contentTransition(.numericText(value: Double(s.counts.todayOpen)))
            }
            .padding(.bottom, 4)
            if s.tasks.today.isEmpty {
                let message: String = s.counts.doneToday > 0 ? "All clear. \(s.counts.doneToday) done today." : "Nothing due today."
                Label(message, systemImage: "checkmark.seal.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(HP.success)
                    .padding(.vertical, 6)
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
            } else {
                ForEach(s.tasks.today.prefix(8)) { task in
                    TaskRow(task: task, today: s.today, compact: true) { toggle(task) }
                        .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity.combined(with: .scale(scale: 0.92, anchor: .leading))))
                }
                if s.tasks.today.count > 8 {
                    Text("+\(s.tasks.today.count - 8) more on the web")
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundStyle(HP.ink3)
                        .padding(.leading, 34)
                }
            }
        }
        .hpCard(padding: 14)
        .animation(HP.spring, value: s.tasks.today)
    }

    private func habits(_ s: Summary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader("Habits", symbol: "circle.dotted.circle", tint: HP.success) {
                Text("\(s.habitsDoneToday) of \(s.habitsToday.count)")
                    .font(HP.number(11, weight: .bold))
                    .foregroundStyle(HP.ink3)
            }
            HStack(spacing: 0) {
                ForEach(s.habitsToday.prefix(6)) { habit in
                    Button {
                        let next = habit.nextProgress
                        if next >= 3 { bursts[habit.id, default: 0] += 1 }
                        Task { await store.setHabit(habit, progress: next) }
                    } label: {
                        VStack(spacing: 5) {
                            HabitRing(progress: habit.progress, icon: habit.icon, name: habit.name, size: 44, celebrate: bursts[habit.id, default: 0])
                            Text(habit.name)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(HP.ink2)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressable)
                    .help("Click to move \(habit.name) a step")
                }
            }
        }
        .hpCard(padding: 14)
    }

    private var captureBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "lightbulb")
                .foregroundStyle(captureFocused ? HP.warm : HP.ink3)
                .symbolEffect(.bounce, value: captured)
            TextField("Capture a thought, or start with + for a task", text: $capture)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .focused($captureFocused)
                .onSubmit(submit)
            if !capture.isEmpty {
                Text("↩")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(HP.ink3)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(HP.surface))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(captureFocused ? HP.accent.opacity(0.5) : HP.hairline))
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .animation(HP.snappy, value: capture.isEmpty)
    }

    private var footer: some View {
        HStack(spacing: 12) {
            if let updated = store.lastUpdated {
                Text("Updated \(updated, style: .relative) ago")
                    .font(.system(size: 11))
                    .foregroundStyle(HP.ink3)
            }
            Spacer()
            Button { Task { await store.refresh() } } label: {
                Image(systemName: "arrow.clockwise")
                    .rotationEffect(.degrees(store.isRefreshing ? 360 : 0))
                    .animation(store.isRefreshing ? .linear(duration: 0.9).repeatForever(autoreverses: false) : .default, value: store.isRefreshing)
            }
            .help("Refresh")
            if let server = store.config?.server {
                Link(destination: server) { Image(systemName: "safari") }
                    .help("Open the web dashboard")
            }
            Button { openSettings(); NSApp.activate(ignoringOtherApps: true) } label: { Image(systemName: "gearshape") }
                .help("Settings")
            Button { NSApp.terminate(nil) } label: { Image(systemName: "power") }
                .help("Quit Hyperpolymath")
        }
        .buttonStyle(.borderless)
        .foregroundStyle(HP.ink2)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(HP.surfaceRaised)
    }

    private func toggle(_ task: TaskItem) {
        Task {
            let ok = await store.toggle(task)
            guard ok, !task.isDone else { return }
            try? await Task.sleep(for: .milliseconds(850))
            withAnimation(HP.spring) { store.sweepDone() }
        }
    }

    /// Enter saves a capture; text starting with "+" becomes a quick-add task.
    private func submit() {
        let text = capture.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        capture = ""
        Task {
            if text.hasPrefix("+") {
                let title = String(text.dropFirst()).trimmingCharacters(in: .whitespaces)
                if !title.isEmpty, await store.addTask(title) != nil { captured += 1 }
            } else if await store.capture(text) != nil {
                captured += 1
            }
        }
    }
}

// MARK: - Not connected

struct MacConnectView: View {
    @Environment(AppStore.self) private var store
    @State private var link = ""
    @State private var error: String?
    @State private var connecting = false

    var body: some View {
        VStack(spacing: 18) {
            ZStack {
                OrbitingRings(size: 130)
                Monogram(size: 54)
            }
            .padding(.top, 18)
            VStack(spacing: 6) {
                Text("Hyperpolymath").font(HP.display(26))
                Text("On the web, open Settings, Phone and Mac, pair a device, then copy the link here.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(HP.ink2)
                    .multilineTextAlignment(.center)
            }
            HStack(spacing: 8) {
                TextField("hyperpolymath://connect?…", text: $link)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(connect)
                Button("Paste") {
                    if let s = NSPasteboard.general.string(forType: .string) { link = s; connect() }
                }
            }
            if let error {
                Text(error).font(.system(size: 12)).foregroundStyle(HP.danger).multilineTextAlignment(.center)
            }
            Button(action: connect) {
                HStack(spacing: 6) {
                    if connecting { ProgressView().controlSize(.small) }
                    Text("Connect")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(link.isEmpty || connecting)
            Button("Quit") { NSApp.terminate(nil) }
                .buttonStyle(.borderless)
                .foregroundStyle(HP.ink3)
                .padding(.bottom, 6)
        }
        .padding(20)
        .background(alignment: .top) { AuroraBackground(intensity: 1.2).frame(height: 260) }
        .animation(HP.spring, value: error)
    }

    private func connect() {
        error = nil
        connecting = true
        Task {
            do {
                try await store.connect(try Pairing.parse(link))
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            connecting = false
        }
    }
}
