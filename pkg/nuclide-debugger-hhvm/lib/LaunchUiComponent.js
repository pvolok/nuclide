'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {React} from 'react-for-atom';
import {AtomInput} from '../../nuclide-ui/lib/AtomInput';
import {LaunchProcessInfo} from './LaunchProcessInfo';
import remoteUri from '../../nuclide-remote-uri';
import type {NuclideUri} from '../../nuclide-remote-uri';

type PropsType = {
  targetUri: NuclideUri;
}
export class LaunchUiComponent extends React.Component<void, PropsType, void> {
  props: PropsType;

  constructor(props: PropsType) {
    super(props);
    (this: any)._getActiveFilePath = this._getActiveFilePath.bind(this);
    (this: any)._handleCancelButtonClick = this._handleCancelButtonClick.bind(this);
    (this: any)._handleLaunchButtonClick = this._handleLaunchButtonClick.bind(this);
  }

  render(): ReactElement {
    return (
      <div className="block">
        <label>Command: </label>
        <AtomInput
          ref="scriptPath"
          tabIndex="11"
          placeholderText="/path/to/my/script.php arg1 arg2"
          initialValue={this._getActiveFilePath()}
        />
        <div className="padded text-right">
          <button className="btn" onClick={this._handleCancelButtonClick}>
            Cancel
          </button>
          <button
              className="btn btn-primary"
              onClick={this._handleLaunchButtonClick}>
            Launch
          </button>
        </div>
      </div>
    );
  }

  _handleLaunchButtonClick(): void {
    const scriptPath = this.refs['scriptPath'].getText().trim();
    const processInfo = new LaunchProcessInfo(this.props.targetUri, scriptPath);
    require('../../nuclide-service-hub-plus')
      .consumeFirstProvider('nuclide-debugger.remote')
      .then(debuggerService => debuggerService.startDebugging(processInfo));
    this._showDebuggerPanel();
    this._handleCancelButtonClick();
  }

  _getActiveFilePath(): string {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor != null) {
      const fileUri = editor.getPath();
      if (fileUri != null && this._isValidScriptUri(fileUri)) {
        return remoteUri.getPath(fileUri);
      }
    }
    return '';
  }

  _isValidScriptUri(uri: NuclideUri): boolean {
    if (!remoteUri.isRemote(uri)) {
      return false;
    }
    const scriptPath = remoteUri.getPath(uri);
    return scriptPath.endsWith('.php') || scriptPath.endsWith('.hh');
  }

  _showDebuggerPanel(): void {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-debugger:show'
    );
  }

  _handleCancelButtonClick(): void {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-debugger:toggle-launch-attach'
    );
  }
}
