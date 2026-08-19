// EditorWrapper passes no `media` prop, so the schema has no media node and nothing downstream of
// it is reachable. CJS and a Proxy because the importers use named imports.
module.exports = new Proxy(function () {}, {
  get: () => undefined,
  apply: () => undefined,
});
