import { altsia_normalize } from 'altsia';
import * as vscode from 'vscode';

export function registerNormalizeCommand(getDisplayLanguage: () => string): vscode.Disposable {
  return vscode.commands.registerTextEditorCommand('altsia.normalize', async (editor) => {
    if (editor.document.languageId !== 'altsia') {
      void vscode.window.showWarningMessage('Altsia normalize only supports .alt documents.');
      return;
    }

    const source = editor.document.getText();

    try {
      const normalized = altsia_normalize(source, getDisplayLanguage(), 40);
      if (normalized === source) {
        return;
      }

      const wholeDocumentRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(source.length)
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(wholeDocumentRange, normalized);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Altsia normalize failed: ${message}`);
    }
  });
}
