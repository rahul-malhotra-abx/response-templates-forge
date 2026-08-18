// Stands in for the media packages at build time. EditorWrapper passes no `media` prop, so the
// editor schema has no media node — verified against a running editor: `schema.nodes.media` is
// undefined. Nothing can insert an attachment, so the upload dialog, the lightbox, the image
// annotator and the PDF renderer behind them are unreachable. Together they were 6.8 MB of the
// 23 MB of input esbuild was reading, and pdfjs-dist carries a HIGH advisory for arbitrary
// script execution when opening a crafted PDF.
//
// CommonJS and a Proxy on purpose: the importers use named imports, and esbuild will not let a
// plain ESM stub satisfy an import it cannot see an export for. A CJS module is opaque to that
// check, and the Proxy answers any property access with undefined.
//
// Delete the aliases in package.json if the editor ever gains a media provider.
module.exports = new Proxy(function () {}, {
  get: () => undefined,
  apply: () => undefined,
});
