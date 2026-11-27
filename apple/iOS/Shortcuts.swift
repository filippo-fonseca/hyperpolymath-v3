import AppIntents

/// Siri and Spotlight phrases. Each must name the app.
struct HyperpolymathShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddCaptureIntent(),
            phrases: ["Capture in \(.applicationName)", "Add a capture to \(.applicationName)", "Jot something in \(.applicationName)"],
            shortTitle: "Capture",
            systemImageName: "lightbulb"
        )
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: ["Add a task in \(.applicationName)", "New \(.applicationName) task"],
            shortTitle: "Add Task",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: OpenCaptureIntent(),
            phrases: ["Open \(.applicationName) capture"],
            shortTitle: "Open Capture",
            systemImageName: "square.and.pencil"
        )
    }
}
