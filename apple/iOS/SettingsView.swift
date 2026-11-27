import SwiftUI
import WidgetKit
import HyperpolymathKit
import HyperpolymathUI

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var confirmDisconnect = false
    @State private var reloaded = 0

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Avatar(url: store.summary?.profile.avatarUrl, name: store.summary?.profile.name, size: 52)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(store.summary?.profile.name ?? "Hyperpolymath")
                                .font(HP.display(20))
                            if let host = store.config?.host {
                                Text(host).font(.system(size: 13)).foregroundStyle(HP.ink3)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("This device") {
                    LabeledContent("Key", value: store.me?.token.name ?? "This iPhone")
                    LabeledContent("Access", value: store.me?.token.scope == "full" ? "Full" : "App only, no MCP")
                    if let tz = store.summary?.timezone { LabeledContent("Timezone", value: tz) }
                    if let updated = store.lastUpdated {
                        LabeledContent("Updated") { Text(updated, style: .relative) }
                    }
                }

                Section {
                    Button {
                        WidgetCenter.shared.reloadAllTimelines()
                        reloaded += 1
                    } label: {
                        Label("Refresh widgets", systemImage: "arrow.clockwise")
                            .symbolEffect(.bounce, value: reloaded)
                    }
                    if let server = store.config?.server {
                        Link(destination: server) {
                            Label("Open the web dashboard", systemImage: "safari")
                        }
                    }
                } header: {
                    Text("Widgets")
                } footer: {
                    Text("Add Hyperpolymath widgets from the home screen or lock screen. Tick tasks and log habits right from them.")
                }

                Section {
                    Button(role: .destructive) { confirmDisconnect = true } label: {
                        Label("Disconnect this iPhone", systemImage: "iphone.slash")
                    }
                } footer: {
                    Text("Removes the key from this iPhone. To cut it off everywhere, disconnect it on the web in Settings, Phone and Mac.")
                }

                Section {
                    Link(destination: URL(string: "https://github.com/filippo-fonseca/hyperpolymath-v3")!) {
                        Label("Source on GitHub", systemImage: "chevron.left.forwardslash.chevron.right")
                    }
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog("Disconnect this iPhone?", isPresented: $confirmDisconnect, titleVisibility: .visible) {
                Button("Disconnect", role: .destructive) {
                    dismiss()
                    store.disconnect()
                }
            } message: {
                Text("Widgets will stop updating until you pair again.")
            }
        }
    }
}
