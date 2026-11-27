import WidgetKit
import SwiftUI
import AppIntents
import HyperpolymathKit
import HyperpolymathUI

/// One tap from the home screen or lock screen to the capture composer.
struct CaptureWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.capture, provider: SummaryProvider()) { entry in
            CaptureWidgetView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
                .widgetURL(URL(string: "hyperpolymath://capture"))
        }
        .configurationDisplayName("Capture")
        .description("Jot a thought in one tap.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

struct CaptureWidgetView: View {
    let entry: SummaryEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if family == .accessoryCircular {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 20, weight: .semibold))
                    .widgetAccentable()
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "lightbulb.max.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(LinearGradient(colors: [HP.warm, Color(hex: 0xFF6A3D)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                Spacer(minLength: 0)
                if let last = entry.summary.captures.recent.first, entry.state != .signedOut {
                    Text(last.content)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(HP.ink2)
                        .lineLimit(2)
                }
                Text("Capture a thought")
                    .font(HP.display(17))
                    .foregroundStyle(HP.ink)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// The Control Center and lock screen button (iOS 18).
@available(iOS 18.0, *)
struct CaptureControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "HyperpolymathCaptureControl") {
            ControlWidgetButton(action: OpenCaptureIntent()) {
                Label("Capture", systemImage: "square.and.pencil")
            }
        }
        .displayName("Capture")
        .description("Open Hyperpolymath ready to capture a thought.")
    }
}
