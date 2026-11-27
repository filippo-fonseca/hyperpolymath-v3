import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

/// Captures: a composer that grows as you type, what came back on its
/// resurface schedule, then everything recent. New notes drop in from the top.
struct CapturesView: View {
    @Environment(AppStore.self) private var store
    @State private var all: [Capture]?
    @State private var draft = ""
    @State private var sending = false
    @State private var sent = 0
    @FocusState private var focused: Bool

    private var recent: [Capture] {
        let fromSummary = store.summary?.captures.recent ?? []
        guard let all else { return fromSummary }
        // Fresh captures from the summary first, then the longer list.
        let ids = Set(fromSummary.map(\.id))
        return fromSummary + all.filter { !ids.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    composer.appear(0)
                    if let resurfaced = store.summary?.captures.resurfaced, !resurfaced.isEmpty {
                        section("Back again", symbol: "sparkles", tint: HP.violet) {
                            ForEach(resurfaced) { c in
                                CaptureCard(capture: c, resurfaced: true) { Task { await store.markSeen(c) } }
                                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                            }
                        }
                        .appear(1)
                    }
                    section("Recent", symbol: "tray.full.fill", tint: HP.ink3) {
                        if recent.isEmpty {
                            EmptyState(symbol: "lightbulb.max.fill", title: "Nothing captured yet", message: "Ideas, links, half-thoughts. Your bots can pick them up later.", tint: HP.warm)
                        }
                        ForEach(recent) { c in
                            CaptureCard(capture: c)
                                .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity).combined(with: .scale(scale: 0.96, anchor: .top)), removal: .opacity))
                        }
                        if all == nil, !recent.isEmpty {
                            Button("Show older") { Task { all = await store.allCaptures() } }
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(HP.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 4)
                        }
                    }
                    .appear(2)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 40)
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
                .animation(HP.spring, value: recent)
                .animation(HP.spring, value: store.summary?.captures.resurfaced ?? [])
            }
            .scrollDismissesKeyboard(.interactively)
            .background(HP.canvas.ignoresSafeArea())
            .refreshable { await store.refresh() }
            .navigationTitle("Captures")
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("What's on your mind?", text: $draft, axis: .vertical)
                .font(.system(size: 17))
                .lineLimit(2...8)
                .focused($focused)
            HStack {
                Text(focused ? "Saved to your captures. Bots see it too." : "Tap to capture a thought")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(HP.ink3)
                    .contentTransition(.opacity)
                Spacer()
                Button(action: send) {
                    ZStack {
                        if sending {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 15, weight: .semibold))
                                .symbolEffect(.bounce.up, value: sent)
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(draft.isEmpty ? HP.ink3 : HP.accent))
                }
                .buttonStyle(.pressable)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
                .accessibilityLabel("Save capture")
            }
        }
        .hpCard()
        .overlay(
            RoundedRectangle(cornerRadius: HP.radius, style: .continuous)
                .strokeBorder(HP.accent.opacity(focused ? 0.45 : 0), lineWidth: 1.5)
        )
        .animation(HP.snappy, value: focused)
        .animation(HP.snappy, value: draft.isEmpty)
        .sensoryFeedback(.success, trigger: sent)
    }

    private func section<Content: View>(_ title: String, symbol: String, tint: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader(title, symbol: symbol, tint: tint).padding(.horizontal, 4)
            content()
        }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        sending = true
        Task {
            if await store.capture(text) != nil {
                draft = ""
                sent += 1
            }
            sending = false
        }
    }
}
