// The image view's body. The width it fits to lives in main.js (`room`); a new size report
// goes back through onRoom.
//
// image: {
//   content,      { path, size } of the image copy
//   room,         the body's width, or null until the first size report
//   onRoom: (width, cx) => void
// }
import { div, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { fitted } from "./image-copies.js";

// Space around an image, on each side.
const IMAGE_PADDING = 20;

// The image at its own size, shrunk to the viewer's width. The width comes from the
// size report, so nothing is drawn until the first one arrives.
export function renderImage(_t, { content, room, onRoom }) {
  const known = room > 0;
  const { width, height } = fitted(content.size, (room ?? 0) - 2 * IMAGE_PADDING);
  return div().id("side-viewer-image").flex_1().min_h(0).overflow_hidden()
    .on_size_change((size, cx) => onRoom(size.width, cx))
    .child(div().id("side-viewer-image-scroll").size_full().overflow_y_scrollbar()
      .when(known, (e) => e.child(h_flex().w_full().justify_center().p(IMAGE_PADDING)
        .child(image(content.path).w(width).h(height).flex_none()))));
}
