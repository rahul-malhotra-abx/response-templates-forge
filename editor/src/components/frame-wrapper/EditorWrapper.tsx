import React, { Component, useEffect } from 'react';
import { Editor, EditorContext, WithEditorActions } from '@atlaskit/editor-core';
import { IframeDataModel } from '../../services/comment/iframe.data.model';
import { editorCardProvider } from '@atlaskit/smart-card';
// The emoji and mention providers are not ported. Both were already commented out at the call
// site below, `@atlaskit/mention` was never declared as a dependency, and the mention provider
// pointed at a placeholder external URL — which would be egress, the thing this move exists to
// remove. Wiring them back up means going through the Forge bridge.

export class EditorWrapper extends Component<{ dataModel: IframeDataModel }, {}> {
  tick() {
    this.setState({});
  }

  componentWillMount() {
    this.tick();
  }

  componentDidMount() {}

  render() {
    const { dataModel } = this.props;
    let lastPosition: any = null;
    setTimeout(() => {
      setInterval(() => {
        // @ts-ignore
        if (lastPosition !== window.editorView?.state.tr.curSelection.$head.pos) {
          // @ts-ignore
          lastPosition = window.editorView?.state.tr.curSelection.$head.pos;
          // @ts-ignore
          const lastPositionPath = window.editorView?.state.tr.curSelection.$head.path;
          // @ts-ignore
          const lastPositionParentOffset = window.editorView?.state.tr.curSelection.$head.parentOffset;
          const props = {
            width: document.getElementsByTagName('html')[0].offsetWidth,
            height: document.getElementsByTagName('html')[0].offsetHeight,
          };
          const value = JSON.stringify({ lastPosition, lastPositionPath, lastPositionParentOffset });
          dataModel.emit('cursor-position', { value, props });
        }
      }, 1500);
    }, 2000);
    return (
      <div>
        <div
          data-testid="comment"
          className={(dataModel.getAttribute('showSave') ? 'show-save' : '') + ' ' + (dataModel.getAttribute('showCancel') ? 'show-cancel' : '')}>
          <EditorContext>
            <WithEditorActions
              render={(actions) => {
                actions.replaceDocument(dataModel.getAttribute('value'));
                const editorView = actions._privateGetEditorView();
                if (editorView) {
                  // @ts-ignore
                  window.editorView = editorView;
                }
                return (
                  <Editor
                    quickInsert={true}
                    smartLinks={{
                      provider: Promise.resolve(editorCardProvider),
                      allowBlockCards: true,
                    }}
                    appearance={dataModel.getAttribute('appearance') || 'comment'}
                    placeholder={dataModel.getAttribute('placeholder') || ''}
                    allowAnalyticsGASV3={dataModel.getAttribute('allowAnalyticsGASV3') || true}
                    shouldFocus={dataModel.getAttribute('shouldFocus') || true}
                    allowTextColor={dataModel.getAttribute('allowTextColor') || true}
                    allowRule={dataModel.getAttribute('allowRule') || true}
                    allowTables={{
                      allowControls: dataModel.getAttribute('allowTables')?.allowControls || true,
                    }}
                    allowHelpDialog={dataModel.getAttribute('allowHelpDialog') || true}
                    feedbackInfo={{
                      product: dataModel.getAttribute('feedbackInfo')?.product || '',
                      labels: dataModel.getAttribute('feedbackInfo')?.labels || [],
                    }}
                    allowExtension={dataModel.getAttribute('allowExtension') || true}
                    secondaryToolbarComponents={[]}
                    onSave={(function (actions: any) {
                      return () => {
                        actions.getValue().then((value: any) => {
                          if (value != null) {
                            dataModel.emit('save', value);
                          }
                        });
                      };
                    })(actions)}
                    onCancel={() => {
                      actions.replaceDocument({
                        version: 1,
                        type: 'doc',
                        content: [],
                      });
                      dataModel.emit('cancel');
                    }}
                    onChange={(editorView, meta) => {
                      if (meta.source === 'local') {
                        actions.getValue().then((value) => {
                          const props = {
                            width: document.getElementsByTagName('html')[0].offsetWidth,
                            height: document.getElementsByTagName('html')[0].offsetHeight,
                          };
                          dataModel.emit('change', { value, props });
                        });
                      }
                    }}
                  />
                );
              }}></WithEditorActions>
          </EditorContext>
        </div>
      </div>
    );
  }
}
