// swift-tools-version: 5.10
// HyperpolymathKit: the code the iPhone app, its widgets and the Mac menu bar
// app share. HyperpolymathKit is plain Foundation (models, API client,
// pairing, keychain, snapshot cache, the app store) and also builds on Linux,
// so CI can test it. HyperpolymathUI is the SwiftUI design system.

import PackageDescription

let package = Package(
    name: "HyperpolymathKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "HyperpolymathKit", targets: ["HyperpolymathKit"]),
        .library(name: "HyperpolymathUI", targets: ["HyperpolymathUI"]),
    ],
    targets: [
        .target(name: "HyperpolymathKit"),
        .target(name: "HyperpolymathUI", dependencies: ["HyperpolymathKit"]),
        .testTarget(
            name: "HyperpolymathKitTests",
            dependencies: ["HyperpolymathKit"],
            resources: [.copy("Fixtures")]
        ),
    ],
    swiftLanguageVersions: [.v5]
)
