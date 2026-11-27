import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

/// The plus button's sheet: a task or a capture, switched with a sliding
/// pill. Sending draws a check, then the sheet steps aside.
struct ComposerSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var mode: Router.Composer
    @State private var text = ""
    @State private var sending = false
    @State private var done = false
    @FocusState private var focused: Bool
    @Namespace private var pill

    init(mode: Router.Composer) {
        _mode = State(initialValue: mode)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                modePicker
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(HP.ink2)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(HP.fill))
                }
                .buttonStyle(.pressable)
                .accessibilityLabel("Close")
            }

            ZStack(alignment: .topLeading) {
                TextField(mode == .task ? "Call the bank tomorrow 5pm p1 #Admin" : "What's on your mind?", text: $text, axis: .vertical)
                    .font(.system(size: 19, weight: .medium))
                    .lineLimit(1...6)
                    .focused($focused)
                    .submitLabel(mode == .task ? .done : .return)
                    .onSubmit { if mode == .task { send() } }
                    .opacity(done ? 0 : 1)
                if done {
                    Label(mode == .task ? "Added" : "Captured", systemImage: "checkmark.circle.fill")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(HP.success)
                        .symbolEffect(.bounce, value: done)
                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                }
            }
            .frame(minHeight: 60, alignment: .topLeading)

            HStack {
                Text(mode == .task ? "Dates, times, p1 to p4 and #Project are picked out for you." : "Bots can read and reply to captures.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(HP.ink3)
                    .contentTransition(.opacity)
                Spacer()
                Button(action: send) {
                    HStack(spacing: 6) {
                        if sending { ProgressView().tint(HP.canvas) }
                        Text(mode == .task ? "Add" : "Save")
                    }
                }
                .buttonStyle(PillButtonStyle(tint: text.isEmpty ? HP.ink3 : HP.ink))
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending || done)
            }
        }
        .padding(22)
        .animation(HP.spring, value: mode)
        .animation(HP.spring, value: done)
        .sensoryFeedback(.success, trigger: done)
        .presentationDetents([.height(250), .medium])
        .presentationCornerRadius(30)
        .presentationBackground(.regularMaterial)
        .onAppear { focused = true }
    }

    private var modePicker: some View {
        HStack(spacing: 2) {
            ForEach([Router.Composer.task, .capture], id: \.self) { option in
                Button {
                    mode = option
                } label: {
                    Label(option == .task ? "Task" : "Capture", systemImage: option == .task ? "checkmark.circle" : "lightbulb")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(mode == option ? HP.canvas : HP.ink2)
                        .padding(.horizontal, 12)
                        .frame(height: 32)
                        .background {
                            if mode == option {
                                Capsule().fill(HP.ink).matchedGeometryEffect(id: "mode", in: pill)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Capsule().fill(HP.fill))
        .sensoryFeedback(.selection, trigger: mode)
    }

    private func send() {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !sending else { return }
        sending = true
        Task {
            let ok: Bool
            if mode == .task {
                ok = await store.addTask(value) != nil
            } else {
                ok = await store.capture(value) != nil
            }
            sending = false
            guard ok else { return }
            done = true
            try? await Task.sleep(for: .milliseconds(700))
            dismiss()
        }
    }
}
