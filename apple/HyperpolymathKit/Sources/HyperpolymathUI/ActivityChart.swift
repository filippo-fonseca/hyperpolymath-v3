#if canImport(SwiftUI) && canImport(Charts)
import SwiftUI
import Charts
import HyperpolymathKit

/// The last two weeks as stacked bars (tasks done in blue, habits finished
/// in green). Bars grow up from zero when the chart first appears; today is
/// full strength and earlier days a touch softer.
public struct ActivityChart: View {
    let days: [ActivityDay]
    let today: String
    var height: CGFloat
    var showAxis: Bool
    @State private var grown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Pass `animated: false` in widgets, which render a still frame.
    public init(days: [ActivityDay], today: String, height: CGFloat = 120, showAxis: Bool = true, animated: Bool = true) {
        self.days = days
        self.today = today
        self.height = height
        self.showAxis = showAxis
        _grown = State(initialValue: !animated)
    }

    private var peak: Int { max(1, days.map { $0.tasksDone + $0.habitsDone }.max() ?? 1) }

    public var body: some View {
        Chart {
            ForEach(days) { day in
                BarMark(
                    x: .value("Day", day.date),
                    y: .value("Done", grown ? Double(day.tasksDone) : 0),
                    width: .ratio(0.6)
                )
                .foregroundStyle(by: .value("Kind", "Tasks"))
                .opacity(day.date == today ? 1 : 0.72)
                .cornerRadius(3)

                BarMark(
                    x: .value("Day", day.date),
                    y: .value("Done", grown ? Double(day.habitsDone) : 0),
                    width: .ratio(0.6)
                )
                .foregroundStyle(by: .value("Kind", "Habits"))
                .opacity(day.date == today ? 1 : 0.72)
                .cornerRadius(3)
            }
        }
        .chartForegroundStyleScale(["Tasks": HP.accent, "Habits": HP.success])
        .chartLegend(.hidden)
        .chartYScale(domain: 0...Double(peak))
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks(values: showAxis ? days.map(\.date) : []) { value in
                AxisValueLabel {
                    Text(HPDate.weekdayLetter(value.as(String.self) ?? ""))
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(HP.ink3)
                }
            }
        }
        .frame(height: height)
        .onAppear {
            guard !grown else { return }
            if reduceMotion {
                grown = true
            } else {
                withAnimation(HP.gentle.delay(0.25)) { grown = true }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Last two weeks")
        .accessibilityValue("\(days.map(\.tasksDone).reduce(0, +)) tasks and \(days.map(\.habitsDone).reduce(0, +)) habits done")
    }
}

/// A legend chip: colored dot, label and total.
public struct LegendChip: View {
    let color: Color
    let label: String
    let value: Int

    public init(color: Color, label: String, value: Int) {
        self.color = color
        self.label = label
        self.value = value
    }

    public var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label).foregroundStyle(HP.ink3)
            Text("\(value)").foregroundStyle(HP.ink).monospacedDigit()
        }
        .font(.system(size: 12, weight: .semibold))
    }
}
#endif
