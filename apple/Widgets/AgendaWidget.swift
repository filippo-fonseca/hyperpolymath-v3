import WidgetKit
import SwiftUI
import HyperpolymathKit
import HyperpolymathUI

/// What's next on your calendar, with a live countdown.
struct AgendaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetKind.agenda, provider: SummaryProvider()) { entry in
            AgendaWidgetView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
                .widgetURL(URL(string: "hyperpolymath://today"))
        }
        .configurationDisplayName("Up next")
        .description("Your next event, counting down.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

struct AgendaWidgetView: View {
    let entry: SummaryEntry
    @Environment(\.widgetFamily) private var family

    private var s: Summary { entry.summary }
    private var upcoming: [CalendarEvent] {
        s.calendar.events
            .filter { !$0.allDay && ($0.endDate ?? .distantPast) > entry.date }
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
    }

    var body: some View {
        if entry.state == .signedOut && family != .accessoryRectangular {
            SignedOutView()
        } else if !s.calendar.connected {
            message("calendar.badge.plus", "Connect Google Calendar on the web to see what's next.")
        } else if let next = upcoming.first, let start = next.startDate {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Group {
                        if start > entry.date {
                            Text("In \(Text(start, style: .relative))")
                        } else {
                            Text("Now")
                        }
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .widgetAccentable()
                    Text(next.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                    Text(HPDate.clock(start, timezone: s.timezone)).font(.system(size: 12)).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(alignment: .top, spacing: 14) {
                    hero(next, start: start)
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(upcoming.dropFirst().prefix(3)) { e in
                            HStack(spacing: 8) {
                                RoundedRectangle(cornerRadius: 1.5).fill(Color(hexString: e.color) ?? HP.accent).frame(width: 3)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(e.title).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(HP.ink).lineLimit(1)
                                    if let st = e.startDate {
                                        Text(HPDate.clock(st, timezone: s.timezone)).font(.system(size: 11)).foregroundStyle(HP.ink3)
                                    }
                                }
                            }
                            .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            default:
                hero(next, start: start)
            }
        } else {
            message("calendar", "Nothing else on the calendar today.")
        }
    }

    private func hero(_ e: CalendarEvent, start: Date) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("UP NEXT")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(HP.accent)
            Text(e.title)
                .font(HP.display(17))
                .foregroundStyle(HP.ink)
                .lineLimit(3)
            Spacer(minLength: 0)
            if start > entry.date {
                Text(start, style: .relative)
                    .font(HP.number(20, weight: .bold))
                    .foregroundStyle(HP.accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            } else {
                Text("Now").font(HP.number(20, weight: .bold)).foregroundStyle(HP.accent)
            }
            Text([HPDate.clock(start, timezone: s.timezone), e.location].compactMap { $0 }.joined(separator: " · "))
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(HP.ink3)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func message(_ symbol: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol).font(.system(size: 22)).foregroundStyle(HP.accent)
            Spacer(minLength: 0)
            Text(text).font(.system(size: 12.5, weight: .medium)).foregroundStyle(HP.ink2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
