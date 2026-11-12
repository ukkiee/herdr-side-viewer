// The reason shown in place of content that cannot be drawn.
import { div } from "gpui-kit";
import { noticeFor } from "./document.js";

export function renderNotice(t, state) {
  return div().flex_1().min_h(0).p(20).text_size(13).text_color(t.dim).child(noticeFor(state) ?? "");
}
