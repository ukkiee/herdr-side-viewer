// The side viewer's header. It only draws: what to show comes from main.js as `header`, and
// every click goes back through one of its callbacks.
//
// header: {
//   file,         the shown file, or null
//   canGoBack,    whether there is a file to go back to
//   state,        this.content.state of the viewer
//   raw,          whether the markdown view shows the source
//   onBack, onToggleRaw, onOriginal, onFinder: (cx) => void
// }
//
// Left to right: back, file name, folder, the markdown switch, then the actions
// (original app, Finder). Each part is one line of renderHeader.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { home } from "herdr";
import { labelOf } from "./document.js";

// The header: back, file name and folder.
export function renderHeader(t, header) {
  const { file, canGoBack, state } = header;
  const label = file ? labelOf(file, home()) : { name: "Side Viewer", folder: "" };
  return h_flex().h(40).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
    .when(canGoBack, (el) => el.child(renderBack(t, header)))
    .child(div().min_w(0).truncate().text_size(13).font_semibold().child(label.name))
    .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(label.folder))
    // The buttons never shrink: a narrow viewer cuts the name and the folder instead.
    // The switch belongs to a drawn markdown document, not to a notice about one.
    .when(state === "markdown", (el) => el.child(renderSwitch(t, header)))
    .when(Boolean(file), (el) => el.child(renderActions(t, header)));
}

// Back, drawn only while there is a file to go back to.
function renderBack(t, { onBack }) {
  return div().id("side-viewer-back").flex_none().w(24).h(24).rounded(4)
    .flex().items_center().justify_center().text_size(14).text_color(t.muted).cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_click((_event, cx) => onBack(cx))
    .child("←");
}

// One button that shows the other view: the source while rendered, the rendering while raw.
function renderSwitch(t, { raw, onToggleRaw }) {
  return raw
    ? renderButton(t, "side-viewer-rendered", "rendered", "렌더링 보기", (_event, cx) => onToggleRaw(cx))
    : renderButton(t, "side-viewer-source", "source", "원문 보기", (_event, cx) => onToggleRaw(cx));
}

// "Open in the original app" and "Show in Finder", for the header and for a notice screen.
function renderActions(t, { onOriginal, onFinder }) {
  return h_flex().flex_none().gap(2)
    .child(renderButton(t, "side-viewer-original", "original", "원래 앱으로 열기", (_event, cx) => onOriginal(cx)))
    .child(renderButton(t, "side-viewer-finder", "finder", "Finder에서 보기", (_event, cx) => onFinder(cx)));
}

function renderButton(t, id, icon, label, onClick) {
  return h_flex().id(id).flex_none().size(24).items_center().justify_center().rounded(4)
    .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(label).on_click(onClick)
    .child(svg(`mods/side-viewer/${icon}.svg`).size(14));
}
