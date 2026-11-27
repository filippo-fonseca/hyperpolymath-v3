import SwiftUI
import ServiceManagement
import HyperpolymathKit
import HyperpolymathUI

struct MacSettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    @State private var confirm = false

    var body: some View {
        Form {
            Section("Account") {
                LabeledContent("Name", value: store.summary?.profile.name ?? "Not connected")
                LabeledContent("Server", value: store.config?.host ?? "None")
                LabeledContent("Key", value: store.me?.token.name ?? "This Mac")
            }
            Section("General") {
                Toggle("Open at login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, on in
                        do {
                            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                        } catch {
                            launchAtLogin = SMAppService.mainApp.status == .enabled
                        }
                    }
            }
            if store.config != nil {
                Section {
                    Button("Disconnect this Mac", role: .destructive) { confirm = true }
                } footer: {
                    Text("Removes the key from this Mac. Revoke it on the web in Settings, Phone and Mac to cut it off everywhere.")
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 420)
        .padding(.vertical, 8)
        .confirmationDialog("Disconnect this Mac?", isPresented: $confirm) {
            Button("Disconnect", role: .destructive) { store.disconnect() }
        }
    }
}
