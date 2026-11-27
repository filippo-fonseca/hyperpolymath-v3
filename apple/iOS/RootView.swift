import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            HP.canvas.ignoresSafeArea()
            switch store.phase {
            case .signedOut:
                OnboardingView()
                    .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .scale(scale: 1.08))))
            case .loading, .ready:
                MainTabs()
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
        }
        .animation(HP.gentle, value: store.phase)
        .tint(HP.accent)
        .overlay(alignment: .top) { NoticeBanner() }
        .sensoryFeedback(.success, trigger: store.celebration)
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            router.takePending()
            Task { await store.refreshIfStale(olderThan: 30) }
        }
        .onChange(of: router.incomingPairing) { _, config in
            guard let config else { return }
            if store.phase == .signedOut {
                // Onboarding picks it up and connects.
            } else {
                router.pendingPairing = config
                router.incomingPairing = nil
            }
        }
        .alert(
            "Switch to this server?",
            isPresented: Binding(get: { router.pendingPairing != nil }, set: { if !$0 { router.pendingPairing = nil } }),
            presenting: router.pendingPairing
        ) { config in
            Button("Switch") { Task { try? await store.connect(config) } }
            Button("Cancel", role: .cancel) {}
        } message: { config in
            Text("This device will use \(config.host) from now on.")
        }
    }
}

struct MainTabs: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            HomeView()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(Router.Tab.today)
            TasksView()
                .tabItem { Label("Tasks", systemImage: "checklist") }
                .tag(Router.Tab.tasks)
                .badge(store.summary?.counts.todayOpen ?? 0)
            CapturesView()
                .tabItem { Label("Captures", systemImage: "tray.full.fill") }
                .tag(Router.Tab.captures)
                .badge(store.summary?.counts.resurfaced ?? 0)
        }
        .sheet(item: $router.composer) { mode in
            ComposerSheet(mode: mode)
        }
        .sheet(isPresented: $router.showSettings) {
            SettingsView()
        }
    }
}

/// Errors slide down from the top and leave on their own.
struct NoticeBanner: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ZStack {
            if let notice = store.notice {
                HStack(spacing: 10) {
                    Image(systemName: notice.quiet ? "wifi.exclamationmark" : "exclamationmark.triangle.fill")
                        .foregroundStyle(notice.quiet ? HP.ink2 : HP.danger)
                    Text(notice.text)
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(HP.ink)
                        .lineLimit(3)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
                .padding(.horizontal, 16)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onTapGesture { store.notice = nil }
                .task(id: notice.id) {
                    try? await Task.sleep(for: .seconds(notice.quiet ? 3 : 5))
                    if store.notice?.id == notice.id { store.notice = nil }
                }
            }
        }
        .animation(HP.spring, value: store.notice)
    }
}
