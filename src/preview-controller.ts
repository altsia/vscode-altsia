import { kodama_to_html } from 'altsia';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { altsiaTextRewriter, getVisitedTextLength, resetVisitedTextLength } from './visitor';
import { altsiaReadFile } from './extern-api';
import { renderJustKatex } from './katex';
import { ContextAPI } from './forester/context-api';
import { collectWorkspaceDocs, toDocId } from './forester/collect-docs';

export class PreviewController implements vscode.Disposable {
  private previewPanel: vscode.WebviewPanel | undefined;
  private previewDocumentUri: vscode.Uri | undefined;
  private readonly mediaRoot: vscode.Uri;
  private readonly wordCountStatusBarItem: vscode.StatusBarItem;
  private cachedContextDocumentUri: string | undefined;
  private cachedContextPromise: Promise<ContextAPI> | undefined;
  private previewRenderVersion = 0;

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
        this.cachedContextDocumentUri = undefined;
        this.cachedContextPromise = undefined;
        this.wordCountStatusBarItem.hide();
      });
    } else {
      this.previewPanel.reveal(vscode.ViewColumn.Beside);
    }

    this.previewDocumentUri = activeEditor.document.uri;
    void this.updatePreview(activeEditor.document);
  }

  async refreshPreview(): Promise<void> {
    if (!this.previewPanel || !this.previewDocumentUri) {
      return;
    }

    const previewDocument = await vscode.workspace.openTextDocument(this.previewDocumentUri);
    await this.updatePreview(previewDocument);
  }

  handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.previewPanel || !this.previewDocumentUri) {
      return;
    }

    if (event.document.uri.toString() !== this.previewDocumentUri.toString()) {
      return;
    }

    void this.updatePreview(event.document);
  }

  handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!this.previewPanel || !editor || !editor.document.fileName.endsWith('.alt')) {
      return;
    }

    this.previewDocumentUri = editor.document.uri;
    void this.updatePreview(editor.document);
  }

  dispose(): void {
    this.previewPanel?.dispose();
    this.wordCountStatusBarItem.dispose();
  }

  private async updatePreview(textDocument: vscode.TextDocument): Promise<void> {
    if (!this.previewPanel) {
      return;
    }
    const renderVersion = ++this.previewRenderVersion;

    this.previewPanel.title = `Preview ${path.basename(textDocument.fileName)}`;
    const editorFontSize = vscode.workspace
      .getConfiguration('editor', textDocument.uri)
      .get<number>('fontSize', 14);
    const bodyFontSize = Number.isFinite(editorFontSize) ? editorFontSize : 14;

    const source = textDocument.getText();
    resetVisitedTextLength();
    // const html = altsia_to_html_with_rewriter(
    //   source,
    //   altsiaTextRewriter,
    //   {
    //     read: (path: string) => altsiaReadFile(textDocument, path),
    //     katex_render: (tex: string) => renderJustKatex(tex, false),
    //     katex_display_render: (tex: string) => renderJustKatex(tex, true)
    //   },
    //   this.getDisplayLanguage()
    // );

    const contextApi = await this.getCachedContext(textDocument);
    if (!this.previewPanel) {
      return;
    }
    if (this.previewDocumentUri?.toString() !== textDocument.uri.toString()) {
      return;
    }
    if (renderVersion !== this.previewRenderVersion) {
      return;
    }

    const html = kodama_to_html(
      source,
      contextApi,
      altsiaTextRewriter,
      {
        read: (path: string) => altsiaReadFile(textDocument, path),
        katex_render: (tex: string) => renderJustKatex(tex, false),
        katex_display_render: (tex: string) => renderJustKatex(tex, true)
      },
      this.getDisplayLanguage()
    )

    const visitedTextLength = getVisitedTextLength();
    this.wordCountStatusBarItem.text = `$(symbol-string) ${visitedTextLength} words`;
    this.wordCountStatusBarItem.tooltip = '[Altsia] word count';
    this.wordCountStatusBarItem.show();
    const katexCssUri = this.previewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.mediaRoot, 'katex', 'katex.css')
    );

    this.previewPanel.webview.html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${katexCssUri}">
</head>
<body>${html}</body>
</html>`;
  }

  private getCachedContext(textDocument: vscode.TextDocument): Promise<ContextAPI> {
    const uri = textDocument.uri.toString();
    if (this.cachedContextDocumentUri === uri && this.cachedContextPromise) {
      return this.cachedContextPromise;
    }

    const contextPromise = (async (): Promise<ContextAPI> => ({
      doc_workspace_path: toDocId(textDocument.uri),
      docs: await collectWorkspaceDocs(textDocument),
    }))();

    this.cachedContextDocumentUri = uri;
    this.cachedContextPromise = contextPromise;
    return contextPromise;
  }
}
