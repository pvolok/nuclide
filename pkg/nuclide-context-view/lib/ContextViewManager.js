'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  Definition,
  DefinitionService,
  DefinitionQueryResult,
} from '../../nuclide-definition-service';
import type {EditorPosition} from '../../commons-atom/debounced';

import invariant from 'assert';
import {CompositeDisposable} from 'atom';
import {React, ReactDOM} from 'react-for-atom';
import {observeTextEditorsPositions} from '../../commons-atom/debounced';
import {Observable} from 'rxjs';
import {ContextViewPanel} from './ContextViewPanel';
import {ProviderContainer} from './ProviderContainer';
import {NoProvidersView} from './NoProvidersView';

export type ContextViewConfig = {
  width: number;
  visible: boolean;
};

export type ContextProvider = {
  /**
   * Context View uses element factories to render providers' React
   * components. This gives Context View the ability to set the props (which
   * contains the currentDefinition) of each provider.
   */
  getElementFactory: () => ((props: {definition: ?Definition}) => React.Element<any>);
  id: string;
  title: string;
};

export class ContextViewManager {

  _atomPanel: atom$Panel;
  _contextProviders: Array<ContextProvider>;
  currentDefinition: ?Definition;
  _definitionService: DefinitionService;
  _disposables: CompositeDisposable;
  _panelDOMElement: ?HTMLElement;
  _defServiceSubscription: rx$ISubscription;
  _width: number;

  constructor(width: number, visible: boolean) {
    this._width = width;
    this._disposables = new CompositeDisposable();
    this._contextProviders = [];
    this.currentDefinition = null;

    this._bindShortcuts();

    if (visible) {
      this._show();
    }
  }

  dispose(): void {
    if (this.isVisible()) {
      this._destroyPanel();
    }
    this._disposables.dispose();
  }

  getWidth(): number {
    return this._width;
  }

  hide(): void {
    if (this.isVisible()) {
      this._destroyPanel();
    }
  }

  isVisible(): boolean {
    return this._panelDOMElement != null;
  }

  registerProvider(newProvider: ContextProvider): boolean {

    // Ensure provider with given ID isn't already registered
    for (let i = 0; i < this._contextProviders.length; i++) {
      if (newProvider.id === this._contextProviders[i].id) {
        return false;
      }
    }

    this._contextProviders.push(newProvider);

    if (this.isVisible()) {
      this._destroyPanel();
      this._show();
    }

    return true;
  }

  serialize(): ContextViewConfig {
    return {
      width: this._width,
      visible: this.isVisible(),
    };
  }

  setDefinitionService(service: ?DefinitionService): void {
    if (service != null) {
      this._definitionService = service;
    }

    this._defServiceSubscription = observeTextEditorsPositions()
      .filter((pos: ?EditorPosition) => pos != null)
      .map((editorPos: ?EditorPosition) => {
        invariant(editorPos != null);
        return this._definitionService.getDefinition(
          editorPos.editor,
          editorPos.position
        );
      }).flatMap((queryResult: ?Promise<?DefinitionQueryResult>) => {
        return (queryResult != null)
          ? Observable.fromPromise(queryResult)
          : Observable.empty();
      })
      .map((queryResult: ?DefinitionQueryResult) => {
        return (queryResult != null)
          ? queryResult.definitions[0]
          : null;
      })
      .subscribe((def: ?Definition) => this.updateCurrentDefinition(def));

    if (this.isVisible()) {
      this._destroyPanel();
      this._show();
    }
  }

  show(): void {
    if (!this.isVisible()) {
      this._show();
    }
  }

  toggle(): void {
    if (this.isVisible()) {
      this._destroyPanel();
    } else {
      this._show();
    }
  }

  deregisterProvider(idToRemove: string): boolean {
    let wasRemoved: boolean = false;
    for (let i = 0; i < this._contextProviders.length; i++) {
      if (this._contextProviders[i].id === idToRemove) {
        // Remove from array
        this._contextProviders.splice(i, 1);
        wasRemoved = true;
      }
    }

    if (this.isVisible()) {
      this._show();
    }
    return wasRemoved;
  }

  updateCurrentDefinition(newDefinition: ?Definition) {
    if (newDefinition === this.currentDefinition) {
      return;
    }

    this.currentDefinition = newDefinition;
    if (this.isVisible()) {
      this._destroyPanel();
      this._show();
    }
  }

  _bindShortcuts() {
    // Bind toggle command
    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-context-view:toggle',
        this.toggle.bind(this)
      )
    );

    // Bind show command
    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-context-view:show',
        this.show.bind(this)
      )
    );

    // Bind hide command
    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-context-view:hide',
        this.hide.bind(this)
      )
    );
  }

  _destroyPanel(): void {
    const tempHandle = this._panelDOMElement;
    if (tempHandle != null) {
      ReactDOM.unmountComponentAtNode(this._panelDOMElement);
      this._atomPanel.destroy();
    }

    this._panelDOMElement = null;
  }

  _onResize(newWidth: number): void {
    this._width = newWidth;
  }

  _show(): void {

    const providerElements: Array<React.Element<any>> =
      this._contextProviders.map((provider, index) => {
        const createElementFn = provider.getElementFactory();
        return (
          <ProviderContainer title={provider.title} key={provider.id}>
            {createElementFn({definition: this.currentDefinition})}
          </ProviderContainer>
        );
      }
    );

    // If there are no providers, put in a placeholder
    if (providerElements.length === 0) {
      providerElements.push(<NoProvidersView key="no-providers-view" />);
    }

    this._panelDOMElement = document.createElement('div');
    // Render the panel in atom workspace
    ReactDOM.render(
      <ContextViewPanel
        initialWidth={this._width}
        onResize={this._onResize.bind(this)}>
        {providerElements}
      </ContextViewPanel>,
      this._panelDOMElement
    );

    invariant(this._panelDOMElement != null);
    this._panelDOMElement.style.display = 'flex';
    this._panelDOMElement.style.height = 'inherit';

    this._atomPanel = atom.workspace.addRightPanel({
      item: this._panelDOMElement,
      priority: 200,
    });
  }

}