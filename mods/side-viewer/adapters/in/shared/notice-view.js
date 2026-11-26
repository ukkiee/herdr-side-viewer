// What shows in place of content that cannot be drawn: a reason, or a spinner where the
// reason's text would start while the file is being read.
import { div, svg } from "gpui-kit";
import { noticeFor } from "../../../core/domain/document.js";

// tr: the viewer's translator (i18n.js). `state` is a state's name or a content (document.js).
export function renderNotice(t, state, tr) {
  if ((typeof state === "object" && state ? state.state : state) === "loading") {
    return div().flex_1().min_h(0).p(20).text_color(t.dim).child(spinner(16));
  }
  return div().flex_1().min_h(0).p(20).text_size(13).text_color(t.dim).child(noticeFor(state, tr) ?? "");
}

// An arc turning once every 800 ms, in the text color around it. It turns natively, so no
// render runs for it. Also the path picker's (picker-view.js).
export function spinner(size) {
  return svg("mods/side-viewer/icons/spinner.svg").size(size).spin(800);
}
