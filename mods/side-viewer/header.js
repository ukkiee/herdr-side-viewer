// The side viewer's header. It only draws: what to show comes from main.js as `header`, and
// every click goes back through one of its callbacks.
//
// header: {
//   file,         the shown file, or null
//   canGoBack,    whether there is a file to go back to
//   state,        this.content.state of the viewer
//   raw,          whether the markdown or svg view shows the source
//   status,       what the shown file's edits read, or null without edits (edit-state.js statusOf):
//                 { kind: "edited" | "failed" | "conflict", message, tip, buttons }
//   tr,           the viewer's translator for the buttons' words (i18n.js)
//   onBack, onToggleRaw, onSave, onDiscard, onOverwrite, onNewTab, onOriginal, onFinder: (cx) => void
// }
//
// Left to right: back, file name, folder, the status and its buttons, the "rendering | source"
// switch, then the actions (new tab, original app, Finder). Each part is one line of renderHeader.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { home } from "herdr";
import { labelOf } from "./document.js";
import { switchable, opensInTab } from "./views.js";

export function renderHeader(t, header) {
  const { file, canGoBack, state, status } = header;
  const label = file ? labelOf(file, home()) : { name: "Side Viewer", folder: "" };
  return h_flex().h(40).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
    .when(canGoBack, (el) => el.child(renderBack(t, header)))
    .child(div().min_w(0).truncate().text_size(13).font_semibold().child(label.name))
    .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(label.folder))
    // The buttons never shrink: a narrow viewer cuts the name and the folder instead, and the
    // status only once those are gone.
    .when(Boolean(file && status), (el) => el.child(renderStatus(t, header)))
    // The switch belongs to a drawn markdown document or svg, not to a notice about one.
    .when(switchable(state), (el) => el.child(renderSwitch(t, header)))
    .when(Boolean(file), (el) => el.child(renderActions(t, header, opensInTab(state))));
}

// Back, drawn only while there is a file to go back to.
function renderBack(t, { onBack }) {
  return div().id("side-viewer-back").flex_none().w(24).h(24).rounded(4)
    .flex().items_center().justify_center().text_size(14).text_color(t.muted).cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_click((_event, cx) => onBack(cx))
    .child("←");
}

// The status and its buttons, drawn only while the shown file has unsaved edits: save, or for
// a conflict "read again" and "overwrite". A failure or conflict reads in the theme's
// attention color; hovering the message shows `tip`, the words a narrow header cuts.
function renderStatus(t, { status, tr, onSave, onDiscard, onOverwrite }) {
  const color = status.kind === "edited" ? (t.accent ?? t.foreground) : (t.blocked ?? t.ansi1 ?? t.foreground);
  // A tiny shrink keeps the message whole while the name and the folder still have room.
  return h_flex().min_w(0).flex_shrink(0.01).gap(6).items_center()
    .child(div().id("side-viewer-status").min_w(0).truncate().text_size(11).text_color(color)
      .tooltip(status.tip).child(status.message))
    .children(status.buttons.map((button) => STATUS_BUTTONS[button](t, { tr, onSave, onDiscard, onOverwrite })));
}

const STATUS_BUTTONS = {
  save: (t, { tr, onSave }) => renderTextButton(t, "side-viewer-save", tr("header.save"), tr("header.saveTip"), onSave),
  discard: (t, { tr, onDiscard }) => renderTextButton(t, "side-viewer-discard", tr("header.discard"), tr("header.discardTip"), onDiscard),
  overwrite: (t, { tr, onOverwrite }) => renderTextButton(t, "side-viewer-overwrite", tr("header.overwrite"), tr("header.overwriteTip"), onOverwrite),
};

function renderTextButton(t, id, label, tip, onClick) {
  return h_flex().id(id).flex_none().h(24).px(8).items_center().rounded(4)
    .border(1).border_color(t.border).text_size(12).cursor_pointer()
    .hover((s) => s.bg(t.hover)).tooltip(tip)
    .on_click((_event, cx) => onClick(cx))
    .child(label);
}

// "Rendered | Source": two cells, the one shown filled. Only the other cell switches.
function renderSwitch(t, { raw, tr, onToggleRaw }) {
  return h_flex().id("side-viewer-switch").flex_none().h(24).p(2).gap(2).items_center().rounded(5)
    .border(1).border_color(t.border)
    .child(renderCell(t, "side-viewer-rendered", tr("header.rendered"), !raw, onToggleRaw))
    .child(renderCell(t, "side-viewer-source", tr("header.source"), raw, onToggleRaw));
}

function renderCell(t, id, label, selected, onToggleRaw) {
  const cell = h_flex().id(id).flex_none().h_full().px(8).items_center().rounded(3).text_size(12);
  if (selected) return cell.bg(t.hover).text_color(t.foreground).child(label);
  return cell.text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover))
    .on_click((_event, cx) => onToggleRaw(cx))
    .child(label);
}

// "Open in a new tab" (`newTab`: only over drawn content, views.js opensInTab), "Open in the
// original app" and "Show in Finder".
function renderActions(t, { tr, onNewTab, onOriginal, onFinder }, newTab) {
  return h_flex().flex_none().gap(2)
    .when(newTab, (el) => el.child(renderButton(t, "side-viewer-new-tab", "new-tab", tr("header.newTab"), (_event, cx) => onNewTab(cx))))
    .child(renderButton(t, "side-viewer-original", "original", tr("header.original"), (_event, cx) => onOriginal(cx)))
    .child(renderButton(t, "side-viewer-finder", "finder", tr("header.finder"), (_event, cx) => onFinder(cx)));
}

function renderButton(t, id, icon, label, onClick) {
  return h_flex().id(id).flex_none().size(24).items_center().justify_center().rounded(4)
    .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover)).tooltip(label).on_click(onClick)
    .child(svg(`mods/side-viewer/${icon}.svg`).size(14));
}
