import WidgetKit
import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

struct SummaryEntry: TimelineEntry {
    enum State { case live, cached, signedOut }

    let date: Date
    let summary: Summary
    let state: State

    static var placeholder: SummaryEntry { SummaryEntry(date: Date(), summary: .sample, state: .live) }
}

/// Every widget reads the same summary: fresh from the server when it can,
/// the app's last snapshot when it can't, sample data for the gallery.
struct SummaryProvider: TimelineProvider {
    func placeholder(in context: Context) -> SummaryEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (SummaryEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
        } else if let cached = SnapshotCache.standard().load() {
            completion(SummaryEntry(date: Date(), summary: cached.summary, state: .cached))
        } else {
            completion(.placeholder)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SummaryEntry>) -> Void) {
        Task {
            let entry = await Self.load()
            let now = Date()
            // Every 20 minutes, and again just after midnight when the day turns over.
            var next = now.addingTimeInterval(20 * 60)
            let cal = HPDate.calendar(entry.summary.timezone)
            if let midnight = cal.nextDate(after: now, matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime), midnight < next {
                next = midnight
            }
            // Countdown widgets also refresh when the next event starts.
            if let start = entry.summary.nextEvent(after: now)?.startDate, start > now, start < next {
                next = start.addingTimeInterval(60)
            }
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    static func load() async -> SummaryEntry {
        let cache = SnapshotCache.standard()
        guard let config = Credentials.standard().load() else {
            return SummaryEntry(date: Date(), summary: cache.load()?.summary ?? .sampleEmpty, state: .signedOut)
        }
        do {
            let fresh = try await APIClient(config: config, timeout: 10).summary()
            cache.save(fresh)
            return SummaryEntry(date: Date(), summary: fresh, state: .live)
        } catch {
            if let cached = cache.load() {
                return SummaryEntry(date: Date(), summary: cached.summary, state: .cached)
            }
            return SummaryEntry(date: Date(), summary: .sampleEmpty, state: .signedOut)
        }
    }
}

/// The shared widget canvas: surface with a whisper of the aurora.
struct WidgetBackground: View {
    var body: some View {
        ZStack {
            HP.surface
            RadialGradient(colors: [HP.accent.opacity(0.10), .clear], center: .topLeading, startRadius: 0, endRadius: 220)
            RadialGradient(colors: [HP.success.opacity(0.07), .clear], center: .bottomTrailing, startRadius: 0, endRadius: 200)
        }
    }
}

/// Shown when the device isn't paired yet.
struct SignedOutView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Monogram(size: 34)
            Spacer(minLength: 0)
            Text("Open Hyperpolymath to connect")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(HP.ink)
            Text("Pair from Settings, Phone and Mac on the web.")
                .font(.system(size: 11))
                .foregroundStyle(HP.ink3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
