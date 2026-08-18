import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChannelModule from 'iframe-channel';

const Channel = ChannelModule.default || ChannelModule;

// Height reported back to the parent, which sets the iframe element to it. Fixed rather than
// measured: the real editor reports window.innerHeight, which is only stable because it echoes a
// size the parent just applied. A placeholder does not need that dance.
const FRAME_HEIGHT = 220;

const textToAdf = (text) => ({
  version: 1,
  type: 'doc',
  content: text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [],
});

const adfToText = (adf) =>
  (adf?.content || [])
    .flatMap((block) => (block.content || []).map((node) => node.text || ''))
    .join('\n');

/**
 * Stands in for jira-editor.appbox.ai while we find out whether Forge will serve a nested
 * same-origin iframe out of the app's own static resources. Speaks the same iframe-channel
 * contract as appbox-ai/reactembed @ 1fd4209, so nothing on the Angular side changes:
 *
 *   in   data                -> props from the parent ({value, placeholder, ...})
 *        action/getProps     -> frame dimensions
 *   out  event {event, data} -> 'change' with the ADF document
 *
 * `cursor-position` is deliberately not emitted. Faking a ProseMirror node path would put
 * nonsense into a saved template; without it `insertVariable` takes its append branch instead.
 */
function App() {
  const [attributes, setAttributes] = useState({});
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const channel = useRef(null);
  // The parent pushes `value` on every setProps. Only seed the textarea from it once, or typing
  // would fight the echo of our own change events.
  const seeded = useRef(false);

  useEffect(() => {
    const ch = new Channel({ targetOrigin: '*' });

    ch.subscribe('data', (data) => {
      setAttributes((previous) => ({ ...previous, ...data }));
      if (!seeded.current && data?.value) {
        seeded.current = true;
        setText(adfToText(data.value));
      }
      return data;
    });

    ch.subscribe('action', (data) =>
      data?.action === 'getProps' ? { props: { width: window.innerWidth, height: FRAME_HEIGHT } } : { error: true },
    );

    // The parent registers callbacks against event names and drops anything it did not ask for,
    // so there is nothing to track here.
    ch.subscribe('listen', (data) => data);

    channel.current = ch;
    setConnected(true);
  }, []);

  const onInput = (event) => {
    const next = event.target.value;
    setText(next);
    channel.current?.postMessage('event', {
      event: 'change',
      data: { value: textToAdf(next), props: { width: window.innerWidth, height: FRAME_HEIGHT } },
    });
  };

  return (
    <div style={{ padding: 12, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        Hello from the self-hosted editor {connected ? '✅' : '…'}
      </div>
      <div style={{ marginBottom: 8, color: '#6b778c', fontSize: 12 }}>
        Served from the app's own static resources — no egress. Placeholder for Atlaskit editor.
      </div>
      <textarea
        value={text}
        onChange={onInput}
        placeholder={attributes.placeholder || 'Type here — text is sent to the parent as ADF'}
        style={{ width: '100%', height: 100, boxSizing: 'border-box', padding: 8, fontFamily: 'inherit', fontSize: 14 }}
      />
      <pre style={{ margin: '8px 0 0', fontSize: 11, color: '#6b778c', whiteSpace: 'pre-wrap' }}>
        props received: {JSON.stringify(attributes)}
      </pre>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
