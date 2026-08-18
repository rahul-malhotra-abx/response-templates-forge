// webpack 4 injected these automatically; esbuild does not. The assert and string_decoder shims
// that @atlaskit/editor-core needs drag in Node's util, which reaches for `process` (stderr,
// nextTick, argv, emitWarning) at module scope — so a bare `process` has to exist before any of
// it evaluates. esbuild's --inject binds this only where the identifier is otherwise unbound.
import processShim from 'process/browser';
import { Buffer as BufferShim } from 'buffer';

export { processShim as process, BufferShim as Buffer };
