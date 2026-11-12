// The markdown view's body. It only draws: the text and the switch come from main.js, and a
// click on a link goes back through onLink.
//
// markdown: {
//   text,         the file's text
//   raw,          whether to show the source instead of the rendering
//   generation,   main.js's count of content replacements
//   onLink: (url, cx) => void
// }
import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { rawMarkdown } from "./links.js";

export function renderMarkdown(_t, { text, raw, generation, onLink }) {
  return div().id("side-viewer-scroll").flex_1().min_h(0).overflow_y_scrollbar()
    .child(h_flex().w_full().justify_center()
      .child(v_flex().flex_1().min_w(0).max_w(860).overflow_hidden().px(28).py(24).text_size(14)
        // The source is drawn by the same element, fenced as one code block.
        // The element needs a new id to draw new text, so the id carries the generation.
        .child(TextView.markdown(`side-viewer-markdown-${generation}${raw ? "-source" : ""}`, raw ? rawMarkdown(text) : text)
          .selectable(true).on_link_click((url, cx) => onLink(url, cx)))));
}
