import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

/// First launch: the monogram inside orbiting rings, three steps, and two
/// ways in (scan or paste the pairing link, or type the details).
struct OnboardingView: View {
    @Environment(AppStore.self) private var store
    @Environment(Router.self) private var router
    @State private var connecting = false
    @State private var error: String?
    @State private var shake = 0
    @State private var showManual = false
    @State private var arrived = false

    var body: some View {
        ZStack {
            AuroraBackground(intensity: 1.5).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 28) {
                    ZStack {
                        OrbitingRings(size: 210)
                            .scaleEffect(connecting ? 1.1 : 1)
                            .opacity(connecting ? 1 : 0.85)
                        Monogram(size: 86)
                            .scaleEffect(connecting ? 0.9 : 1)
                    }
                    .padding(.top, 40)
                    .scaleEffect(arrived ? 1 : 0.6)
                    .opacity(arrived ? 1 : 0)

                    VStack(spacing: 8) {
                        Text("Hyperpolymath")
                            .font(HP.display(40))
                            .foregroundStyle(HP.ink)
                        Text("Your day at a glance, on your home screen, lock screen and Mac menu bar.")
                            .font(.system(size: 16))
                            .foregroundStyle(HP.ink2)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                    .appear(1)

                    VStack(alignment: .leading, spacing: 16) {
                        step(1, "On the web, open Settings, then Phone and Mac.")
                        step(2, "Tap Pair device to show a code.")
                        step(3, "Point your iPhone camera at it and tap the banner.")
                    }
                    .hpCard(padding: 20)
                    .padding(.horizontal, 20)
                    .appear(2)

                    VStack(spacing: 12) {
                        PasteButton(payloadType: String.self) { strings in
                            guard let text = strings.first else { return }
                            Task { await connect { try Pairing.parse(text) } }
                        }
                        .buttonBorderShape(.capsule)
                        .controlSize(.large)
                        .tint(HP.accent)
                        .labelStyle(.titleAndIcon)

                        Button("Enter server and key instead") { showManual = true }
                            .font(.system(size: 14.5, weight: .medium))
                            .foregroundStyle(HP.ink2)

                        if let error {
                            Text(error)
                                .font(.system(size: 13.5, weight: .medium))
                                .foregroundStyle(HP.danger)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 28)
                                .modifier(Shake(animatableData: CGFloat(shake)))
                                .animation(.linear(duration: 0.4), value: shake)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                        if connecting {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Connecting…").foregroundStyle(HP.ink2)
                            }
                            .font(.system(size: 14, weight: .medium))
                            .transition(.opacity)
                        }
                    }
                    .appear(3)
                    .padding(.bottom, 40)
                }
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .animation(HP.spring, value: error)
        .animation(HP.spring, value: connecting)
        .sheet(isPresented: $showManual) {
            ManualConnectSheet { server, token in
                showManual = false
                Task { await connect { try Pairing.manual(server: server, token: token) } }
            }
        }
        .onAppear { withAnimation(HP.gentle.delay(0.1)) { arrived = true } }
        .task(id: router.incomingPairing) {
            guard let config = router.incomingPairing else { return }
            router.incomingPairing = nil
            await connect { config }
        }
    }

    private func step(_ n: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text("\(n)")
                .font(HP.number(14, weight: .bold))
                .foregroundStyle(HP.accent)
                .frame(width: 28, height: 28)
                .background(Circle().fill(HP.accentSoft))
            Text(text)
                .font(.system(size: 15))
                .foregroundStyle(HP.ink)
                .padding(.top, 4)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func connect(_ make: () throws -> ServerConfig) async {
        error = nil
        do {
            let config = try make()
            connecting = true
            try await store.connect(config)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            shake += 1
        }
        connecting = false
    }
}

/// A horizontal wobble for "that didn't work".
struct Shake: GeometryEffect {
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 8 * sin(animatableData * .pi * 4), y: 0))
    }
}

struct ManualConnectSheet: View {
    var onConnect: (String, String) -> Void
    @State private var server = ""
    @State private var token = ""
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: Field?

    enum Field { case server, token }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("hyperpolymath.example.com", text: $server)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .server)
                        .submitLabel(.next)
                        .onSubmit { focus = .token }
                } header: {
                    Text("Server")
                } footer: {
                    Text("The address of your Hyperpolymath dashboard.")
                }
                Section {
                    SecureField("hpm_…", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .token)
                        .submitLabel(.go)
                        .onSubmit(submit)
                } header: {
                    Text("Device key")
                } footer: {
                    Text("Make one in Settings, Phone and Mac. Copy the link and paste it here, or just the key.")
                }
            }
            .navigationTitle("Connect")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Connect", action: submit).disabled(server.isEmpty || token.isEmpty)
                }
            }
            .onAppear { focus = .server }
        }
        .presentationDetents([.medium])
    }

    private func submit() {
        // A whole pairing link pasted into the key field works too.
        if let config = try? Pairing.parse(token) {
            onConnect(config.server.absoluteString, config.token)
        } else {
            onConnect(server, token)
        }
    }
}
