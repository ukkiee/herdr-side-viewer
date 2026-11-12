// The code view's body: the editor state main.js made after the read.
import { div } from "gpui-kit";
import { Editor } from "gpui-base";

export function renderCode(_t, content) {
  return div().flex_1().min_h(0).overflow_hidden().child(Editor.new(content.editor).size_full());
}
