// The markdown document as chunk views (markdown-chunks.js). A viewer copy keeps one
// MarkdownDocument. Whenever the viewer asks to be drawn again it first calls sync with what
// it shows, which makes, changes and releases the views; its render() then only puts them in
// the column (shown). A chunk view draws again only when sync or imageChanged tells it to: a
// new text or parse, new code cards, another language, or a picture of its own that is ready.
// So a render() of the viewer, which Herdr asks for whenever its spaces, agents or focus
// change, draws no block at all.
//
// Views are made, told to draw and released only from calls that started in the viewer's
// init: its event handlers and its tasks. In Herdr 0.1.18 a view made from work a render()
// woke (a promise it settled) belongs to another call and can't be mounted
// ("this Entity has been released and can no longer be mounted").
//
// A click inside a chunk runs in the chunk's call: its cx draws the chunk, not the viewer, and
// a task it starts belongs to the chunk and ends with it. So the viewer's work for the click
// waits in post() and rings the viewer (main.js sends itself the "click" command), whose
// command loop runs it with the viewer's own cx (act).
import { View } from "gpui-kit";
import { chunksOf, codeCountOf } from "../logic/markdown-chunks.js";
import { imageFileOf, imagesOf } from "../../../core/app/markdown-images.js";

class MarkdownChunk extends View {
  init(props) {
    // The part is the document's, which changes it in place before it tells this view to
    // draw again.
    this.part = props.part;
  }

  render() {
    return this.part.draw(this.part);
  }
}

// What the viewer shows: { file, text, generation, cards, lang } or null. A theme change
// needs no sync: Herdr draws every view again for it.
const same = (a, b) => a === b || (Boolean(a) && Boolean(b) && a.file === b.file && a.text === b.text
  && a.generation === b.generation && a.cards === b.cards && a.lang === b.lang);

export class MarkdownDocument {
  // `parse(text)` is the viewer's shared parse (markdown-chunks.js, parsedOf). `draw(part)`
  // returns the elements of one chunk (main.js, drawChunk). `ring()` asks the viewer to call
  // act() from a call of its own.
  constructor({ parse, draw, ring }) {
    this.parse = parse;
    this.draw = draw;
    this.ring = ring;
    // What the views were made for.
    this.made = null;
    // The parse the views were made from.
    this.doc = null;
    // One part per chunk view: { start, end, blocks, from, cards, images, file, doc,
    // generation, draw }. `from` is the chunk's first code card, `images` the image files it
    // shows.
    this.parts = [];
    this.views = [];
    // The chunks' clicks waiting for the viewer's call.
    this.actions = [];
  }

  // From a chunk's click: `action(cx)` runs soon after with the viewer's cx.
  post(action) {
    this.actions.push(action);
    this.ring();
  }

  // From the viewer's own call: runs the chunks' clicks, each in a task of its own so one that
  // throws is reported and the rest still run.
  act(cx) {
    const actions = this.actions;
    this.actions = [];
    for (const action of actions) cx.spawn(async (cx) => action(cx));
  }

  // From the viewer's render(): the chunk views to draw for the file `file`, with the parse
  // and generation they were drawn from. Views of another file are not drawn.
  shown(file) {
    if (this.made?.file !== file) return { views: [], doc: null, generation: 0 };
    return { views: this.views, doc: this.doc, generation: this.made.generation };
  }

  // Makes the views match `want`, what the viewer shows (null: no markdown rendering). A new
  // text or parse draws every chunk again; new cards or another language only the chunks
  // they reach.
  sync(want, cx) {
    const made = this.made;
    if (same(want, made)) return;
    if (!want) {
      this.release(0);
      this.made = null;
      this.doc = null;
      return;
    }
    const doc = this.parse(want.text);
    const fresh = !made || doc !== this.doc || made.file !== want.file || made.generation !== want.generation;
    if (fresh) {
      const chunks = chunksOf(doc.blocks);
      let from = 0;
      chunks.forEach(({ start, end }, index) => {
        const blocks = doc.blocks.slice(start, end);
        const cards = codeCountOf(blocks);
        const images = new Set(imagesOf(blocks).map((src) => imageFileOf(src, want.file)).filter(Boolean));
        const fields = { start, end, blocks, from, cards, images, file: want.file, doc, generation: want.generation };
        from += cards;
        if (index < this.views.length) {
          Object.assign(this.parts[index], fields);
          cx.notify(this.views[index]);
        } else {
          const part = { ...fields, draw: this.draw };
          this.parts.push(part);
          this.views.push(cx.new(MarkdownChunk, { part }));
        }
      });
      this.release(chunks.length);
    } else {
      this.parts.forEach((part, index) => {
        if (want.lang !== made.lang || (want.cards !== made.cards && part.cards > 0)) cx.notify(this.views[index]);
      });
    }
    this.made = want;
    this.doc = doc;
  }

  // Releases the views from index `keep` on.
  release(keep) {
    for (const view of this.views.splice(keep)) view.release();
    this.parts.splice(keep);
  }

  // A picture's copy is ready or failed (markdown-image-loader.js): the chunks showing it
  // draw again.
  imageChanged(image, cx) {
    this.parts.forEach((part, index) => {
      if (part.images.has(image)) cx.notify(this.views[index]);
    });
  }
}
