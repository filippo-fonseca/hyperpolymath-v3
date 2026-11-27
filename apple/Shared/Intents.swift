import AppIntents
import WidgetKit
import HyperpolymathKit

// App Intents shared by the app and the widget extension. The first two make
// widget buttons interactive; the rest show up in Shortcuts, Siri, Spotlight
// and the Control Center button.

struct CompleteTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Complete Task"
    static let isDiscoverable = false

    @Parameter(title: "Task ID")
    var taskID: String

    init() {}

    init(taskID: String) {
        self.taskID = taskID
    }

    func perform() async throws -> some IntentResult {
        try await WidgetActions.complete(taskID: taskID)
        return .result()
    }
}

struct LogHabitIntent: AppIntent {
    static let title: LocalizedStringResource = "Log Habit"
    static let isDiscoverable = false

    @Parameter(title: "Habit ID")
    var habitID: String

    @Parameter(title: "Progress", default: 3)
    var progress: Int

    init() {}

    init(habitID: String, progress: Int) {
        self.habitID = habitID
        self.progress = progress
    }

    func perform() async throws -> some IntentResult {
        try await WidgetActions.logHabit(id: habitID, progress: progress)
        return .result()
    }
}

struct AddCaptureIntent: AppIntent {
    static let title: LocalizedStringResource = "Add Capture"
    static let description = IntentDescription("Save a thought to your Hyperpolymath captures.")

    @Parameter(title: "Text", requestValueDialog: "What's on your mind?")
    var text: String

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await WidgetActions.capture(text)
        return .result(dialog: "Captured.")
    }
}

struct AddTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Add Task"
    static let description = IntentDescription("Add a task. Dates, times, p1 to p4 and #Project work like quick add.")

    @Parameter(title: "Task", requestValueDialog: "What do you need to do?")
    var text: String

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let task = try await WidgetActions.addTask(text)
        return .result(dialog: "Added \(task.title).")
    }
}

/// Opens the app straight into the capture composer.
struct OpenCaptureIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Capture"
    static let description = IntentDescription("Open Hyperpolymath ready to capture a thought.")
    static let openAppWhenRun = true

    init() {}

    func perform() async throws -> some IntentResult {
        PendingRoute.set("capture")
        return .result()
    }
}
