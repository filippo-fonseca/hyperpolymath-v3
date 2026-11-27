#if canImport(SwiftUI)
import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The Hyperpolymath look, matched to the web dashboard's tokens
/// (src/app/globals.css): a near-white canvas, ink text, one accent blue,
/// soft layered shadows and 22pt continuous corners, with a dark mode.
public enum HP {
    // MARK: Colors

    public static let canvas = Color(light: 0xFCFCFC, dark: 0x0B0B0D)
    public static let surface = Color(light: 0xFFFFFF, dark: 0x17171A)
    public static let surfaceRaised = Color(light: 0xF7F7F7, dark: 0x202024)
    public static let ink = Color(light: 0x141414, dark: 0xF4F4F5)
    public static let ink2 = Color(light: 0x141414, dark: 0xF4F4F5, opacity: 0.61)
    public static let ink3 = Color(light: 0x141414, dark: 0xF4F4F5, opacity: 0.42)
    public static let hairline = Color(light: 0x141414, dark: 0xFFFFFF, opacity: 0.07)
    public static let fill = Color(light: 0x141414, dark: 0xFFFFFF, opacity: 0.05)

    public static let accent = Color(hex: 0x1084FE)
    public static let accentSoft = Color(hex: 0x1084FE).opacity(0.12)
    public static let success = Color(hex: 0x2FB26B)
    public static let danger = Color(hex: 0xFF263C)
    public static let warm = Color(hex: 0xFF9F0A)
    public static let violet = Color(hex: 0x7C5CFF)

    /// The day ring's two tracks: tasks (blue to violet) and habits (green to teal).
    public static let taskGradient = AngularGradient(colors: [Color(hex: 0x1084FE), Color(hex: 0x7C5CFF), Color(hex: 0x1084FE)], center: .center)
    public static let habitGradient = AngularGradient(colors: [Color(hex: 0x2FB26B), Color(hex: 0x19C3B4), Color(hex: 0x2FB26B)], center: .center)

    public static func priority(_ p: Int) -> Color {
        switch p {
        case 3: return danger
        case 2: return warm
        case 1: return accent
        default: return ink3
        }
    }

    // MARK: Type

    /// Editorial serif for greetings and big titles, like the web monogram.
    public static func display(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }

    /// Rounded figures for counts and rings.
    public static func number(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded).monospacedDigit()
    }

    // MARK: Shape and motion

    public static let radius: CGFloat = 22
    public static let spring = Animation.spring(response: 0.42, dampingFraction: 0.82)
    public static let snappy = Animation.spring(response: 0.28, dampingFraction: 0.72)
    public static let gentle = Animation.spring(response: 0.9, dampingFraction: 0.86)
}

public extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    /// A color that follows light and dark mode.
    init(light: UInt32, dark: UInt32, opacity: Double = 1) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            UIColor(Color(hex: traits.userInterfaceStyle == .dark ? dark : light, opacity: opacity))
        })
        #elseif canImport(AppKit)
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            return NSColor(Color(hex: isDark ? dark : light, opacity: opacity))
        })
        #else
        self.init(hex: light, opacity: opacity)
        #endif
    }

    /// "#1084fe" from the server, or nil.
    init?(hexString: String?) {
        guard var s = hexString?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(hex: v)
    }
}

// MARK: - Card

public struct CardStyle: ViewModifier {
    var padding: CGFloat
    @Environment(\.colorScheme) private var scheme

    public func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: HP.radius, style: .continuous)
                    .fill(HP.surface)
                    .shadow(color: .black.opacity(scheme == .dark ? 0.0 : 0.04), radius: 1, y: 1)
                    .shadow(color: .black.opacity(scheme == .dark ? 0.35 : 0.06), radius: 14, y: 8)
            }
            .overlay {
                RoundedRectangle(cornerRadius: HP.radius, style: .continuous)
                    .strokeBorder(HP.hairline, lineWidth: 0.75)
            }
    }
}

public extension View {
    /// The dashboard's widget card: surface fill, hairline, soft layered shadow.
    func hpCard(padding: CGFloat = 18) -> some View { modifier(CardStyle(padding: padding)) }
}

/// A small uppercase card heading with an optional trailing accessory.
public struct CardHeader<Trailing: View>: View {
    let title: String
    let symbol: String
    let tint: Color
    let trailing: Trailing

    public init(_ title: String, symbol: String, tint: Color = HP.ink3, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.symbol = symbol
        self.tint = tint
        self.trailing = trailing()
    }

    public var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(tint)
            Text(title.uppercased())
                .font(.system(size: 11.5, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(HP.ink3)
            Spacer(minLength: 8)
            trailing
        }
    }
}

public extension CardHeader where Trailing == EmptyView {
    init(_ title: String, symbol: String, tint: Color = HP.ink3) {
        self.init(title, symbol: symbol, tint: tint) { EmptyView() }
    }
}

// MARK: - Buttons

/// Presses shrink a little with a spring, like the web's active:scale-95.
public struct PressableStyle: ButtonStyle {
    var scale: CGFloat

    public init(scale: CGFloat = 0.95) {
        self.scale = scale
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(HP.snappy, value: configuration.isPressed)
    }
}

public extension ButtonStyle where Self == PressableStyle {
    static var pressable: PressableStyle { PressableStyle() }
}

/// A filled capsule button: dark by default, accent for primary actions.
public struct PillButtonStyle: ButtonStyle {
    var tint: Color
    var foreground: Color

    public init(tint: Color = HP.ink, foreground: Color = HP.canvas) {
        self.tint = tint
        self.foreground = foreground
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 20)
            .frame(minHeight: 48)
            .background(Capsule().fill(tint))
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(HP.snappy, value: configuration.isPressed)
    }
}
#endif
