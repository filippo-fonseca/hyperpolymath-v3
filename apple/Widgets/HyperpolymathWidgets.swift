import WidgetKit
import SwiftUI

@main
struct HyperpolymathWidgets: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        HabitsWidget()
        AgendaWidget()
        CaptureWidget()
        if #available(iOS 18.0, *) {
            CaptureControl()
        }
    }
}
