// esbuild does not polyfill node builtins. editor-core's assert/string_decoder chain reaches for
// `process` at module scope, so it has to exist before anything evaluates.
import processShim from 'process/browser';
import { Buffer as BufferShim } from 'buffer';

export { processShim as process, BufferShim as Buffer };
