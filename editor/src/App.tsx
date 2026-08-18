import React from 'react';
import './index.css';
import { IframeDataModel } from './services/comment/iframe.data.model';
import { EditorWrapper } from './components/frame-wrapper/EditorWrapper';
import { IntlProvider } from 'react-intl-next';

const Channel = require('iframe-channel').default;

/**
 * Ported verbatim from appbox-ai/reactembed @ 1fd4209, which is what jira-editor.appbox.ai serves.
 * The message contract is unchanged, so the Angular side sees the same editor it always has — only
 * the origin moved, from an external host to this app's own static resources.
 */
class App extends React.Component<any, { dataModel: IframeDataModel }> {
  constructor(props: any) {
    super(props);
    this.state = { dataModel: new IframeDataModel({ showSave: false, showCancel: false }) };
  }

  componentDidMount() {
    const channel = new Channel({
      targetOrigin: '*',
    });
    const { dataModel } = this.state;
    channel.subscribe('listen', (data: any, message: any, eventObj: any) => {
      const { event } = data;
      dataModel.on(event, async (data: any) => {
        await channel.postMessage('event', { event, data });
      });
    });
    channel.subscribe('action', (data: any, message: any, eventObj: any) => {
      const { action } = data;
      if (action === 'getProps') {
        return { props: dataModel.getSysProps() };
      }
      return { error: true };
    });
    channel.subscribe('data', (data: any, message: any, event: any) => {
      Object.assign(dataModel.attributes, data);
      this.setState({ dataModel: dataModel });
      return data;
    });
  }

  render() {
    const { dataModel } = this.state;
    return (
      <div className="App">
        <IntlProvider locale="en">
          <EditorWrapper dataModel={dataModel} />
        </IntlProvider>
      </div>
    );
  }
}

export default App;
