
import * as vscode from 'vscode';
import {
  getInitialDisplayLanguage,
  registerSetDisplayLanguageCommand,
} from './display-language-command';
import { registerCommentLineCommand } from './comment-line-command';
import { registerNormalizeCommand } from './normalize-provider';
import { PreviewController } from './preview-controller';

export function activate(context: vscode.ExtensionContext): void {
  let displayLanguage = getInitialDisplayLanguage(context);
  const getDisplayLanguage = (): string => displayLanguage;
  const setDisplayLanguage = (value: string): void => {
    displayLanguage = value;
  };

  const previewController = new PreviewController(context.extensionUri, getDisplayLanguage);

  const openPreviewCommand = vscode.commands.registerCommand('altsiaPreview.openPreviewToSide', () => {
    previewController.openPreviewToSide();
  });

  const commentLineCommand = registerCommentLineCommand();
  const setDisplayLanguageCommand = registerSetDisplayLanguageCommand({
    context,
    getDisplayLanguage,
    setDisplayLanguage,
    onDisplayLanguageChanged: async () => {
      await previewController.refreshPreview();
    },
  });
  const normalizeCommand = registerNormalizeCommand(getDisplayLanguage);
  const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
    previewController.handleDocumentChange(event);
  });
  const changeActiveEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
    previewController.handleActiveEditorChange(editor);
  });

  context.subscriptions.push(
    previewController,
    openPreviewCommand,
    commentLineCommand,
    setDisplayLanguageCommand,
    normalizeCommand,
    changeDocumentSubscription,
    changeActiveEditorSubscription
  );
}

export function deactivate(): void { }
