// The bar between the header and the content. It only draws: what it says comes from
// edit-state.js (barOf) through main.js, and its two buttons call back into main.js.
//
// bar: {
//   kind,        "conflict": the file changed on disk, with the two buttons; "failed": a reason only
//   message,     what the bar says
//   onDiscard, onOverwrite: (cx) => void
// }
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

export function renderBar(t, bar) {
  return h_flex().flex_none().flex_wrap().px(12).py(6).gap(8).items_center()
    .border_b(1).border_color(t.border).bg(t.chrome ?? t.surface ?? t.background)
    .child(div().flex_1().min_w(0).text_size(12).text_color(t.blocked ?? t.foreground).child(bar.message))
    .when(bar.kind === "conflict", (el) => el
      .child(renderButton(t, "side-viewer-discard", "내 수정 버리고 다시 읽기", bar.onDiscard))
      .child(renderButton(t, "side-viewer-overwrite", "내 것으로 덮어쓰기", bar.onOverwrite)));
}

function renderButton(t, id, label, onClick) {
  return h_flex().id(id).flex_none().h(24).px(8).items_center().rounded(4)
    .border(1).border_color(t.border).text_size(12).cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_click((_event, cx) => onClick(cx))
    .child(label);
}
