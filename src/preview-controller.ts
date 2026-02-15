import { altsia_to_html_with_visitor } from 'altsia';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { altsia_visitor, getVisitedTextLength, resetVisitedTextLength } from './visitor';

export class PreviewController implements vscode.Disposable {
  private previewPanel: vscode.WebviewPanel | undefined;
  private previewDocumentUri: vscode.Uri | undefined;
  private readonly mediaRoot: vscode.Uri;
  private readonly wordCountStatusBarItem: vscode.StatusBarItem;

  constructor(
    extensionUri: vscode.Uri,
    private readonly getDisplayLanguage: () => string
  ) {
    this.mediaRoot = vscode.Uri.joinPath(extensionUri, 'media');
    this.wordCountStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
  }

  openPreviewToSide(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !activeEditor.document.fileName.endsWith('.alt')) {
      return;
    }

    if (!this.previewPanel) {
      this.previewPanel = vscode.window.createWebviewPanel(
        'altsiaPreview',
        'Altsia Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: [this.mediaRoot],
        }
      );

      this.previewPanel.onDidDispose(() => {
        this.previewPanel = undefined;
        this.previewDocumentUri = undefined;
        this.wordCountStatusBarItem.hide();
      });
    } else {
      this.previewPanel.reveal(vscode.ViewColumn.Beside);
    }

    this.previewDocumentUri = activeEditor.document.uri;
    this.updatePreview(activeEditor.document);
  }

  async refreshPreview(): Promise<void> {
    if (!this.previewPanel || !this.previewDocumentUri) {
      return;
    }

    const previewDocument = await vscode.workspace.openTextDocument(this.previewDocumentUri);
    this.updatePreview(previewDocument);
  }

  handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.previewPanel || !this.previewDocumentUri) {
      return;
    }

    if (event.document.uri.toString() !== this.previewDocumentUri.toString()) {
      return;
    }

    this.updatePreview(event.document);
  }

  handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!this.previewPanel || !editor || !editor.document.fileName.endsWith('.alt')) {
      return;
    }

    this.previewDocumentUri = editor.document.uri;
    this.updatePreview(editor.document);
  }

  dispose(): void {
    this.previewPanel?.dispose();
    this.wordCountStatusBarItem.dispose();
  }

  private updatePreview(textDocument: vscode.TextDocument): void {
    if (!this.previewPanel) {
      return;
    }

    this.previewPanel.title = `Preview ${path.basename(textDocument.fileName)}`;
    const editorFontSize = vscode.workspace
      .getConfiguration('editor', textDocument.uri)
      .get<number>('fontSize', 14);
    const bodyFontSize = Number.isFinite(editorFontSize) ? editorFontSize : 14;

    const source = textDocument.getText();
    resetVisitedTextLength();
    const html = altsia_to_html_with_visitor(source, altsia_visitor, this.getDisplayLanguage());
    const visitedTextLength = getVisitedTextLength();
    this.wordCountStatusBarItem.text = `$(symbol-string) ${visitedTextLength} words`;
    this.wordCountStatusBarItem.tooltip = '[Altsia] word count';
    this.wordCountStatusBarItem.show();
    const katexCssUri = this.previewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.mediaRoot, 'katex', 'katex.min.css')
    );

    this.previewPanel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${katexCssUri}">
  <style>
    body {
      font-size: ${bodyFontSize}px;
    }
  </style>
</head>
<body>${html}</body>
</html>`;
  }
}
