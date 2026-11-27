#if canImport(SwiftUI)
import SwiftUI
import HyperpolymathKit

/// A round-capped progress arc over a faint track. Animates any change.
public struct ProgressRing<Style: ShapeStyle>: View {
    var progress: Double
    var lineWidth: CGFloat
    var style: Style
    var track: Color

    public init(progress: Double, lineWidth: CGFloat = 10, style: Style, track: Color = HP.fill) {
        self.progress = progress
        self.lineWidth = lineWidth
        self.style = style
        self.track = track
    }

    public var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.0001, min(1, progress)))
                .stroke(style, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(lineWidth / 2)
    }
}

/// The hero: tasks on the outer ring, habits on the inner, both sweeping in
/// from zero the first time they appear and gliding on every change after.
public struct DayRing<Center: View>: View {
    let tasks: Double
    let habits: Double
    let size: CGFloat
    let center: Center
    @State private var shownTasks: Double = 0
    @State private var shownHabits: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(tasks: Double, habits: Double, size: CGFloat = 156, @ViewBuilder center: () -> Center) {
        self.tasks = tasks
        self.habits = habits
        self.size = size
        self.center = center()
    }

    public var body: some View {
        let outer = size * 0.095
        let inner = size * 0.075
        ZStack {
            ProgressRing(progress: shownTasks, lineWidth: outer, style: HP.taskGradient, track: HP.accent.opacity(0.12))
            ProgressRing(progress: shownHabits, lineWidth: inner, style: HP.habitGradient, track: HP.success.opacity(0.12))
                .padding(outer + 5)
            center
        }
        .frame(width: size, height: size)
        .onAppear {
            if reduceMotion {
                shownTasks = tasks
                shownHabits = habits
            } else {
                withAnimation(HP.gentle.delay(0.2)) { shownTasks = tasks }
                withAnimation(HP.gentle.delay(0.35)) { shownHabits = habits }
            }
        }
        .onChange(of: tasks) { _, value in withAnimation(HP.spring) { shownTasks = value } }
        .onChange(of: habits) { _, value in withAnimation(HP.spring) { shownHabits = value } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tasks \(Int(tasks * 100)) percent, habits \(Int(habits * 100)) percent")
    }
}

/// The day ring without the entrance animation, for widgets and the menu
/// bar icon, which render still frames.
public struct StaticDayRing<Center: View>: View {
    let tasks: Double
    let habits: Double
    let size: CGFloat
    let center: Center

    public init(tasks: Double, habits: Double, size: CGFloat = 64, @ViewBuilder center: () -> Center) {
        self.tasks = tasks
        self.habits = habits
        self.size = size
        self.center = center()
    }

    public var body: some View {
        let outer = size * 0.11
        let inner = size * 0.085
        ZStack {
            ProgressRing(progress: tasks, lineWidth: outer, style: HP.taskGradient, track: HP.accent.opacity(0.14))
            ProgressRing(progress: habits, lineWidth: inner, style: HP.habitGradient, track: HP.success.opacity(0.14))
                .padding(outer + size * 0.03)
            center
        }
        .frame(width: size, height: size)
    }
}

/// A habit's day in three steps (started, almost, done), like the web's
/// 4-state ring. Done turns the ring green with a check and a little burst.
public struct HabitRing: View {
    let progress: Int
    let icon: String?
    let name: String
    var size: CGFloat
    var celebrate: Int

    public init(progress: Int, icon: String?, name: String, size: CGFloat = 58, celebrate: Int = 0) {
        self.progress = progress
        self.icon = icon
        self.name = name
        self.size = size
        self.celebrate = celebrate
    }

    private var done: Bool { progress >= 3 }
    private var lineWidth: CGFloat { size * 0.1 }

    public var body: some View {
        ZStack {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .trim(from: Double(i) / 3 + 0.025, to: Double(i + 1) / 3 - 0.025)
                    .stroke(i < progress ? (done ? HP.success : HP.accent) : HP.fill, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(lineWidth / 2)
            }
            Circle()
                .fill(done ? HP.success.opacity(0.14) : Color.clear)
                .padding(lineWidth * 1.6)
            Group {
                if done {
                    Image(systemName: "checkmark")
                        .font(.system(size: size * 0.3, weight: .bold))
                        .foregroundStyle(HP.success)
                        .transition(.scale(scale: 0.3).combined(with: .opacity))
                } else if let icon, !icon.isEmpty {
                    Text(icon)
                        .font(.system(size: size * 0.34))
                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                } else {
                    Text(String(name.prefix(1)).uppercased())
                        .font(HP.display(size * 0.36))
                        .foregroundStyle(HP.ink2)
                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                }
            }
            Burst(trigger: celebrate, color: HP.success, radius: size * 0.62)
        }
        .frame(width: size, height: size)
        .scaleEffect(done ? 1.0 : 0.97)
        .animation(HP.spring, value: progress)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
        .accessibilityValue(["Not started", "Started", "Almost done", "Done"][max(0, min(3, progress))])
    }
}

/// Dots that fly out of a point and fade, played each time `trigger` changes.
public struct Burst: View {
    let trigger: Int
    var color: Color
    var count: Int
    var radius: CGFloat
    @State private var t: CGFloat = 1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(trigger: Int, color: Color = HP.accent, count: Int = 10, radius: CGFloat = 36) {
        self.trigger = trigger
        self.color = color
        self.count = count
        self.radius = radius
    }

    public var body: some View {
        ZStack {
            ForEach(0..<count, id: \.self) { i in
                let angle: Double = Double(i) / Double(count) * 2 * Double.pi
                let base: CGFloat = i % 3 == 0 ? 7 : 5
                let dot: CGFloat = base * (1 - t * 0.6)
                let reach: CGFloat = radius * t
                Circle()
                    .fill(i % 2 == 0 ? color : HP.warm)
                    .frame(width: dot, height: dot)
                    .offset(x: CGFloat(cos(angle)) * reach, y: CGFloat(sin(angle)) * reach)
                    .opacity(Double(1 - t))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: trigger) { _, _ in
            guard !reduceMotion else { return }
            var reset = Transaction()
            reset.disablesAnimations = true
            withTransaction(reset) { t = 0 }
            DispatchQueue.main.async {
                withAnimation(.easeOut(duration: 0.75)) { t = 1 }
            }
        }
    }
}

/// The round checkbox: the fill blooms from the center and the tick draws itself.
public struct CheckCircle: View {
    let isOn: Bool
    var tint: Color
    var size: CGFloat

    public init(isOn: Bool, tint: Color = HP.accent, size: CGFloat = 24) {
        self.isOn = isOn
        self.tint = tint
        self.size = size
    }

    public var body: some View {
        ZStack {
            Circle().strokeBorder(isOn ? tint : tint.opacity(0.55), lineWidth: 1.7)
            Circle()
                .fill(tint)
                .scaleEffect(isOn ? 1 : 0.1)
                .opacity(isOn ? 1 : 0)
            CheckShape()
                .trim(from: 0, to: isOn ? 1 : 0)
                .stroke(Color.white, style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round, lineJoin: .round))
                .padding(size * 0.29)
        }
        .frame(width: size, height: size)
        .animation(HP.snappy, value: isOn)
    }
}

public struct CheckShape: Shape {
    public init() {}

    public func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.55))
        p.addLine(to: CGPoint(x: rect.minX + rect.width * 0.36, y: rect.maxY - rect.height * 0.08))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.1))
        return p
    }
}
#endif
