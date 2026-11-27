#if canImport(SwiftUI)
import SwiftUI

// MARK: - Staggered entrance

struct AppearModifier: ViewModifier {
    let index: Int
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 22)
            .scaleEffect(shown || reduceMotion ? 1 : 0.98, anchor: .top)
            .blur(radius: shown || reduceMotion ? 0 : 8)
            .onAppear {
                guard !shown else { return }
                withAnimation(HP.spring.delay(reduceMotion ? 0 : Double(index) * 0.07)) { shown = true }
            }
    }
}

public extension View {
    /// Rise, sharpen and fade in, `index` steps after the first card.
    func appear(_ index: Int) -> some View { modifier(AppearModifier(index: index)) }
}

// MARK: - Shimmer for loading placeholders

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { geo in
                    LinearGradient(colors: [.clear, Color.white.opacity(0.55), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: geo.size.width * 0.6)
                        .offset(x: phase * geo.size.width * 1.4)
                        .blendMode(.plusLighter)
                }
                .mask(content)
            }
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) { phase = 1 }
            }
    }
}

public extension View {
    func shimmer() -> some View { modifier(ShimmerModifier()) }
}

/// A rounded gray bar that shimmers, standing in for text while loading.
public struct SkeletonBar: View {
    var width: CGFloat?
    var height: CGFloat

    public init(width: CGFloat? = nil, height: CGFloat = 14) {
        self.width = width
        self.height = height
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: height / 2, style: .continuous)
            .fill(HP.fill)
            .frame(width: width, height: height)
            .shimmer()
    }
}

// MARK: - Aurora

/// Slow drifting color fields behind the header: blue, violet and green
/// light that breathes. Still when Reduce Motion is on.
public struct AuroraBackground: View {
    var intensity: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme

    public init(intensity: Double = 1) {
        self.intensity = intensity
    }

    public var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 24, paused: reduceMotion)) { context in
            GeometryReader { geo in
                let size = geo.size
                let drift = Drift(time: reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate)
                ZStack {
                    blob(HP.accent, size: size.width * 0.9)
                        .offset(x: size.width * (drift.a - 0.28), y: size.height * (drift.b - 0.18))
                    blob(HP.violet, size: size.width * 0.75)
                        .offset(x: size.width * (drift.c + 0.32), y: size.height * (drift.d - 0.05))
                    blob(HP.success, size: size.width * 0.6)
                        .offset(x: size.width * drift.e, y: size.height * (drift.f + 0.22))
                }
                .frame(width: size.width, height: size.height)
            }
        }
        .opacity((scheme == .dark ? 0.55 : 0.32) * intensity)
        .blur(radius: 50)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// Slow sine offsets, as fractions of the view's size.
    private struct Drift {
        let a, b, c, d, e, f: CGFloat

        init(time t: Double) {
            a = CGFloat(sin(t / 7) * 0.12)
            b = CGFloat(cos(t / 9) * 0.08)
            c = CGFloat(cos(t / 8) * 0.10)
            d = CGFloat(sin(t / 6) * 0.10)
            e = CGFloat(sin(t / 10) * 0.18)
            f = CGFloat(cos(t / 7.5) * 0.06)
        }
    }

    private func blob(_ color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(RadialGradient(colors: [color, color.opacity(0)], center: .center, startRadius: 0, endRadius: size / 2))
            .frame(width: size, height: size)
    }
}

// MARK: - Brand

/// The serif "H" on paper, the same monogram as the web app icon.
public struct Monogram: View {
    var size: CGFloat

    public init(size: CGFloat = 64) {
        self.size = size
    }

    public var body: some View {
        Text("H")
            .font(.system(size: size * 0.66, weight: .medium, design: .serif))
            .foregroundStyle(Color(hex: 0x141414))
            .offset(y: -size * 0.02)
            .frame(width: size, height: size)
            .background(
                RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                    .fill(Color(hex: 0xFCFCFC))
                    .shadow(color: .black.opacity(0.08), radius: size * 0.05, y: size * 0.03)
                    .shadow(color: .black.opacity(0.10), radius: size * 0.2, y: size * 0.12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                    .strokeBorder(Color.black.opacity(0.06), lineWidth: 0.75)
            )
            .accessibilityLabel("Hyperpolymath")
    }
}

/// Rings that orbit the monogram while connecting; `speed` scales the spin.
public struct OrbitingRings: View {
    var speed: Double
    var size: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(speed: Double = 1, size: CGFloat = 220) {
        self.speed = speed
        self.size = size
    }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate * speed
            ZStack {
                ring(diameter: size, width: 2, trim: 0.32, color: HP.accent, angle: t * 50)
                ring(diameter: size * 0.78, width: 2.5, trim: 0.22, color: HP.violet, angle: -t * 70 + 120)
                ring(diameter: size * 0.58, width: 3, trim: 0.4, color: HP.success, angle: t * 95 + 240)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func ring(diameter: CGFloat, width: CGFloat, trim: Double, color: Color, angle: Double) -> some View {
        ZStack {
            Circle().stroke(color.opacity(0.10), lineWidth: width)
            Circle()
                .trim(from: 0, to: trim)
                .stroke(AngularGradient(colors: [color.opacity(0), color], center: .center, startAngle: .degrees(0), endAngle: .degrees(360 * trim)), style: StrokeStyle(lineWidth: width, lineCap: .round))
                .rotationEffect(.degrees(angle))
        }
        .frame(width: diameter, height: diameter)
    }
}

// MARK: - Empty state

/// A calm icon, a title and a line, used when a list has nothing in it.
public struct EmptyState: View {
    let symbol: String
    let title: String
    let message: String
    var tint: Color
    @State private var bounce = 0

    public init(symbol: String, title: String, message: String, tint: Color = HP.success) {
        self.symbol = symbol
        self.title = title
        self.message = message
        self.tint = tint
    }

    public var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(tint)
                .symbolEffect(.bounce, value: bounce)
                .frame(width: 64, height: 64)
                .background(Circle().fill(tint.opacity(0.12)))
            Text(title)
                .font(HP.display(19))
                .foregroundStyle(HP.ink)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(HP.ink3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .onAppear { bounce += 1 }
    }
}
#endif
