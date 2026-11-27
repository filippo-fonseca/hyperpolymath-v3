import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

/// Today, the week ahead and the inbox, with a sliding pill picker and a
/// quick-add bar that understands "tomorrow 5pm p1 #Project".
struct TasksView: View {
    enum Scope: String, CaseIterable, Identifiable {
        case today = "Today", upcoming = "Upcoming", inbox = "Inbox"
        var id: String { rawValue }
    }

    @Environment(AppStore.self) private var store
    @State private var scope: Scope = .today
    @State private var inbox: [TaskItem]?
    @State private var draft = ""
    @State private var adding = false
    @FocusState private var focused: Bool
    @Namespace private var pill

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    picker
                    content
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 120)
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(HP.canvas.ignoresSafeArea())
            .refreshable {
                await store.refresh()
                if scope == .inbox { inbox = await store.tasks(.inbox) }
            }
            .safeAreaInset(edge: .bottom) { quickAdd }
            .navigationTitle("Tasks")
            .task(id: scope) {
                if scope == .inbox && inbox == nil { inbox = await store.tasks(.inbox) }
            }
        }
    }

    // MARK: Picker

    private var picker: some View {
        HStack(spacing: 4) {
            ForEach(Scope.allCases) { option in
                Button {
                    withAnimation(HP.spring) { scope = option }
                } label: {
                    HStack(spacing: 6) {
                        Text(option.rawValue)
                        if let n = count(option), n > 0 {
                            Text("\(n)")
                                .font(HP.number(11.5, weight: .bold))
                                .foregroundStyle(scope == option ? HP.accent : HP.ink3)
                                .contentTransition(.numericText(value: Double(n)))
                        }
                    }
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(scope == option ? HP.ink : HP.ink2)
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .frame(maxWidth: .infinity)
                    .background {
                        if scope == option {
                            Capsule()
                                .fill(HP.surface)
                                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
                                .matchedGeometryEffect(id: "pill", in: pill)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Capsule().fill(HP.fill))
        .sensoryFeedback(.selection, trigger: scope)
    }

    private func count(_ scope: Scope) -> Int? {
        guard let s = store.summary else { return nil }
        switch scope {
        case .today: return s.counts.todayOpen
        case .upcoming: return s.counts.upcoming
        case .inbox: return s.counts.inbox
        }
    }

    // MARK: Lists

    @ViewBuilder
    private var content: some View {
        if let s = store.summary {
            switch scope {
            case .today:
                group(title: nil, tasks: s.tasks.today, today: s.today, empty: ("checkmark.seal.fill", "All clear", "Nothing left for today."))
            case .upcoming:
                let days = Dictionary(grouping: s.tasks.upcoming) { $0.dueDate ?? "" }
                if days.isEmpty {
                    EmptyState(symbol: "calendar.badge.checkmark", title: "A quiet week", message: "Nothing due in the next seven days.", tint: HP.accent)
                        .hpCard()
                } else {
                    ForEach(days.keys.sorted(), id: \.self) { date in
                        group(title: dayTitle(date, today: s.today), tasks: days[date] ?? [], today: s.today, empty: nil)
                    }
                }
            case .inbox:
                if let inbox {
                    group(title: nil, tasks: inbox, today: s.today, empty: ("tray.fill", "Inbox zero", "Tasks without a date land here."))
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(0..<4, id: \.self) { _ in SkeletonBar(height: 16) }
                    }
                    .hpCard()
                }
            }
        }
    }

    private func dayTitle(_ date: String, today: String) -> String {
        switch HPDate.daysBetween(today, date) {
        case 1: return "Tomorrow"
        default: return HPDate.longDay(date)
        }
    }

    @ViewBuilder
    private func group(title: String?, tasks: [TaskItem], today: String, empty: (String, String, String)?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if let title {
                Text(title)
                    .font(HP.display(19))
                    .foregroundStyle(HP.ink)
                    .padding(.bottom, 4)
            }
            if tasks.isEmpty, let empty {
                EmptyState(symbol: empty.0, title: empty.1, message: empty.2)
            } else {
                ForEach(tasks) { task in
                    TaskRow(task: task, today: today) { toggle(task) }
                        .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity.combined(with: .move(edge: .trailing))))
                    if task.id != tasks.last?.id {
                        Divider().overlay(HP.hairline).padding(.leading, 43)
                    }
                }
            }
        }
        .hpCard()
        .animation(HP.spring, value: tasks)
        .transition(.opacity.combined(with: .offset(y: 12)))
    }

    private func toggle(_ task: TaskItem) {
        let inInbox = inbox?.contains { $0.id == task.id } ?? false
        if inInbox, let i = inbox?.firstIndex(where: { $0.id == task.id }) {
            inbox?[i].status = task.isDone ? .todo : .done
        }
        Task {
            let ok = await store.toggle(task)
            if !ok, inInbox, let i = inbox?.firstIndex(where: { $0.id == task.id }) {
                inbox?[i].status = task.status
                return
            }
            guard ok, !task.isDone else { return }
            try? await Task.sleep(for: .milliseconds(850))
            withAnimation(HP.spring) {
                store.sweepDone()
                inbox?.removeAll { $0.isDone }
            }
        }
    }

    // MARK: Quick add

    private var quickAdd: some View {
        HStack(spacing: 10) {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(focused ? HP.accent : HP.ink3)
            TextField("Add a task, like “Gym tomorrow 7am p2”", text: $draft)
                .font(.system(size: 15.5))
                .focused($focused)
                .submitLabel(.done)
                .onSubmit(add)
            if !draft.isEmpty {
                Button(action: add) {
                    Group {
                        if adding {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "arrow.up").font(.system(size: 15, weight: .bold))
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(HP.accent))
                }
                .buttonStyle(.pressable)
                .transition(.scale.combined(with: .opacity))
                .accessibilityLabel("Add task")
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .frame(minHeight: 52)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(focused ? HP.accent.opacity(0.5) : HP.hairline, lineWidth: 1))
        .shadow(color: .black.opacity(0.08), radius: 14, y: 6)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .animation(HP.snappy, value: draft.isEmpty)
        .animation(HP.snappy, value: focused)
    }

    private func add() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !adding else { return }
        adding = true
        Task {
            if let task = await store.addTask(text) {
                draft = ""
                if task.dueDate == nil { withAnimation(HP.spring) { inbox?.insert(task, at: 0) } }
                // Show where it went.
                let target: Scope = task.dueDate == nil ? .inbox : (task.dueDate! <= (store.summary?.today ?? "") ? .today : .upcoming)
                if target != scope { withAnimation(HP.spring) { scope = target } }
            }
            adding = false
        }
    }
}
