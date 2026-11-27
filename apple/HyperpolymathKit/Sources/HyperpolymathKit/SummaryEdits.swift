import Foundation

/// Optimistic edits to a summary, applied the instant you tap so the UI and
/// widgets move before the server answers. Pure, so tests pin them down; the
/// next refresh replaces the whole summary with the server's truth anyway.
public extension Summary {
    /// Mark a task done locally. Counts move with it.
    mutating func markDone(taskID: String) {
        guard let i = tasks.today.firstIndex(where: { $0.id == taskID }), !tasks.today[i].isDone else {
            if let j = tasks.upcoming.firstIndex(where: { $0.id == taskID }) { tasks.upcoming[j].status = .done }
            return
        }
        let wasOverdue = tasks.today[i].overdue
        tasks.today[i].status = .done
        counts.todayOpen = max(0, counts.todayOpen - 1)
        if wasOverdue { counts.overdue = max(0, counts.overdue - 1) }
        counts.doneToday += 1
        bumpActivity(tasks: 1)
    }

    /// Undo `markDone` locally.
    mutating func markOpen(taskID: String) {
        guard let i = tasks.today.firstIndex(where: { $0.id == taskID }), tasks.today[i].isDone else {
            if let j = tasks.upcoming.firstIndex(where: { $0.id == taskID }) { tasks.upcoming[j].status = .todo }
            return
        }
        tasks.today[i].status = .todo
        counts.todayOpen += 1
        if tasks.today[i].overdue { counts.overdue += 1 }
        counts.doneToday = max(0, counts.doneToday - 1)
        bumpActivity(tasks: -1)
    }

    /// Fold in the server's answer to a completion. A recurring task comes
    /// back open with its next date: it leaves today and joins upcoming.
    mutating func settle(task: TaskItem) {
        if let i = tasks.today.firstIndex(where: { $0.id == task.id }) {
            if task.isDone {
                tasks.today[i] = task
            } else if let due = task.dueDate, due > today {
                tasks.today.remove(at: i)
                if let d = HPDate.daysBetween(today, due), d <= 7, !tasks.upcoming.contains(where: { $0.id == task.id }) {
                    tasks.upcoming.append(task)
                    tasks.upcoming.sort { ($0.dueDate ?? "", $0.dueTime ?? "") < ($1.dueDate ?? "", $1.dueTime ?? "") }
                    counts.upcoming += 1
                }
            } else {
                tasks.today[i] = task
            }
        }
    }

    /// Drop tasks already marked done, after their check animation has played.
    mutating func sweepDone() {
        tasks.today.removeAll(where: \.isDone)
        tasks.upcoming.removeAll(where: \.isDone)
    }

    /// Insert a freshly created task where it belongs.
    mutating func insert(task: TaskItem) {
        guard !task.isDone else { return }
        if let due = task.dueDate, due <= today {
            tasks.today.insert(task, at: 0)
            counts.todayOpen += 1
            if task.overdue { counts.overdue += 1 }
        } else if let due = task.dueDate, let d = HPDate.daysBetween(today, due), d <= 7 {
            tasks.upcoming.append(task)
            tasks.upcoming.sort { ($0.dueDate ?? "", $0.dueTime ?? "") < ($1.dueDate ?? "", $1.dueTime ?? "") }
            counts.upcoming += 1
        } else if task.dueDate == nil {
            counts.inbox += 1
        }
    }

    /// Set a habit's progress for today locally.
    mutating func setHabit(id: String, progress: Int) {
        guard let i = habits.firstIndex(where: { $0.id == id }) else { return }
        let clamped = max(0, min(3, progress))
        let wasDone = habits[i].isDone
        habits[i].progress = clamped
        if let w = habits[i].week.firstIndex(where: { $0.date == today }) { habits[i].week[w].progress = clamped }
        let nowDone = clamped >= 3
        if nowDone != wasDone {
            habits[i].streak = max(0, habits[i].streak + (nowDone ? 1 : -1))
            bumpActivity(habits: nowDone ? 1 : -1)
        }
    }

    mutating func replace(habit: Habit) {
        if let i = habits.firstIndex(where: { $0.id == habit.id }) { habits[i] = habit }
    }

    mutating func insert(capture: Capture) {
        captures.recent.removeAll { $0.id == capture.id }
        captures.recent.insert(capture, at: 0)
    }

    mutating func markSeen(captureID: String) {
        let before = captures.resurfaced.count
        captures.resurfaced.removeAll { $0.id == captureID }
        if captures.resurfaced.count < before { counts.resurfaced = max(0, counts.resurfaced - 1) }
    }

    private mutating func bumpActivity(tasks t: Int = 0, habits h: Int = 0) {
        guard let i = activity.lastIndex(where: { $0.date == today }) else { return }
        activity[i].tasksDone = max(0, activity[i].tasksDone + t)
        activity[i].habitsDone = max(0, activity[i].habitsDone + h)
    }
}
