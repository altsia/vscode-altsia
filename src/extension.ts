
import { altsia_to_html_with_visitor } from 'altsia';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { altsia_visitor, getVisitedTextLength, resetVisitedTextLength } from './visitor';
import { DISPLAY_LANGUAGE_OPTIONS, DISPLAY_LANGUAGE_STATE_KEY } from './languages';

export function activate(context: vscode.ExtensionContext): void {
  let previewPanel: vscode.WebviewPanel | undefined;
  let previewDocumentUri: vscode.Uri | undefined;
  const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media');
  const wordCountStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  let displayLanguage = resolveSupportedLanguageCode(
    context.globalState.get<string>(DISPLAY_LANGUAGE_STATE_KEY) ?? vscode.env.language
  );

  const updatePreview = (textDocument: vscode.TextDocument): void => {
    if (!previewPanel) {
      return;
    }

    previewPanel.title = `Preview ${path.basename(textDocument.fileName)}`;
    const editorFontSize = vscode.workspace
      .getConfiguration('editor', textDocument.uri)
      .get<number>('fontSize', 14);
    const bodyFontSize = Number.isFinite(editorFontSize) ? editorFontSize : 14;

    const source = textDocument.getText();
    resetVisitedTextLength();
    const html = altsia_to_html_with_visitor(source, altsia_visitor, displayLanguage);
    const visitedTextLength = getVisitedTextLength();
    wordCountStatusBarItem.text = `$(symbol-string) ${visitedTextLength} words`;
    wordCountStatusBarItem.tooltip = '[Altsia] word count';
    wordCountStatusBarItem.show();
    const katexCssUri = previewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(mediaRoot, 'katex', 'katex.min.css')
    );

    previewPanel.webview.html = `<!DOCTYPE html>
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
  };

  const openPreviewCommand = vscode.commands.registerCommand('altsiaPreview.openPreviewToSide', () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !activeEditor.document.fileName.endsWith('.alt')) {
      return;
    }

    if (!previewPanel) {
      previewPanel = vscode.window.createWebviewPanel(
        'altsiaPreview',
        'Altsia Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: [mediaRoot]
        }
      );

      previewPanel.onDidDispose(() => {
        previewPanel = undefined;
        previewDocumentUri = undefined;
        wordCountStatusBarItem.hide();
      });
    } else {
      previewPanel.reveal(vscode.ViewColumn.Beside);
    }

    previewDocumentUri = activeEditor.document.uri;
    updatePreview(activeEditor.document);
  });

  const commentLineCommand = vscode.commands.registerTextEditorCommand(
    'altsia.commentLine',
    async (editor) => {
      if (editor.document.languageId !== 'altsia') {
        await vscode.commands.executeCommand('editor.action.commentLine');
        return;
      }

      const targetLineNumbers = collectTargetLineNumbers(editor.selections);

      await editor.edit((editBuilder) => {
        for (const lineNumber of targetLineNumbers) {
          const line = editor.document.lineAt(lineNumber);
          const lineText = line.text;
          const leadingWhitespace = lineText.match(/^\s*/)?.[0] ?? '';
          const content = lineText.slice(leadingWhitespace.length);
          const toggledContent = toggleAltsiaLineComment(content);
          editBuilder.replace(line.range, `${leadingWhitespace}${toggledContent}`);
        }
      });
    }
  );

  const setDisplayLanguageCommand = vscode.commands.registerCommand(
    'altsia.displayLanguage.set',
    async () => {
      const defaultLanguage = resolveSupportedLanguageCode(vscode.env.language);
      const pickItems: Array<
        vscode.QuickPickItem & { itemType: 'default' | 'language'; value?: string }
      > = [
          {
            itemType: 'default',
            label: `Use VS Code Default: ${formatDisplayLanguageLabel(defaultLanguage)}`,
            description: 'Use vscode.env.language',
          },
          ...DISPLAY_LANGUAGE_OPTIONS.map((option) => ({
            itemType: 'language' as const,
            label: option.label,
            value: option.value,
            description:
              option.value.toLowerCase() === displayLanguage.toLowerCase() ? 'Current' : undefined,
          })),
        ];

      const picked = await vscode.window.showQuickPick(pickItems, {
        title: 'Altsia Display Language',
        placeHolder: 'Select from all available languages',
      });

      if (!picked) {
        return;
      }

      if (picked.itemType === 'default') {
        await context.globalState.update(DISPLAY_LANGUAGE_STATE_KEY, undefined);
        displayLanguage = defaultLanguage;
      } else {
        if (!picked.value) {
          return;
        }
        displayLanguage = picked.value;
        await context.globalState.update(DISPLAY_LANGUAGE_STATE_KEY, displayLanguage);
      }

      if (previewPanel && previewDocumentUri) {
        const previewDocument = await vscode.workspace.openTextDocument(previewDocumentUri);
        updatePreview(previewDocument);
      }

      vscode.window.showInformationMessage(
        `Altsia display language is now ${formatDisplayLanguageLabel(displayLanguage)}.`
      );
    }
  );

  const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!previewPanel || !previewDocumentUri) {
      return;
    }

    if (event.document.uri.toString() !== previewDocumentUri.toString()) {
      return;
    }

    updatePreview(event.document);
  });

  const changeActiveEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!previewPanel || !editor || !editor.document.fileName.endsWith('.alt')) {
      return;
    }

    previewDocumentUri = editor.document.uri;
    updatePreview(editor.document);
  });

  context.subscriptions.push(
    wordCountStatusBarItem,
    openPreviewCommand,
    commentLineCommand,
    setDisplayLanguageCommand,
    changeDocumentSubscription,
    changeActiveEditorSubscription
  );
}

export function deactivate(): void { }

function collectTargetLineNumbers(selections: readonly vscode.Selection[]): number[] {
  const lineNumbers = new Set<number>();

  for (const selection of selections) {
    if (selection.isEmpty) {
      lineNumbers.add(selection.active.line);
      continue;
    }

    const startLine = selection.start.line;
    const endLine =
      selection.end.character === 0
        ? Math.max(startLine, selection.end.line - 1)
        : selection.end.line;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      lineNumbers.add(lineNumber);
    }
  }

  return Array.from(lineNumbers).sort((a, b) => a - b);
}

function toggleAltsiaLineComment(content: string): string {
  const unwrapped = unwrapAltsiaLineComment(content);
  if (unwrapped !== undefined) {
    return unwrapped;
  }

  return `(% ${content})`;
}

function unwrapAltsiaLineComment(content: string): string | undefined {
  if (!content.startsWith('(%') || !content.endsWith(')')) {
    return undefined;
  }

  const inner = content.slice(2, -1);
  if (inner.startsWith(' ')) {
    return inner.slice(1);
  }

  return inner;
}

function normalizeLanguageCode(value: string): string {
  const normalizedValue = value.trim().replace(/_/g, '-');
  const parts = normalizedValue.split('-').filter((part) => part.length > 0);

  if (parts.length === 0) {
    return 'en';
  }

  const [language, ...suffixes] = parts;
  const normalizedSuffixes = suffixes.map((suffix) => {
    if (suffix.length === 2) {
      return suffix.toUpperCase();
    }
    if (suffix.length === 4) {
      return `${suffix[0].toUpperCase()}${suffix.slice(1).toLowerCase()}`;
    }
    return suffix;
  });

  return [language.toLowerCase(), ...normalizedSuffixes].join('-');
}

function resolveSupportedLanguageCode(value: string): string {
  const normalizedValue = normalizeLanguageCode(value);
  const matchedOption = DISPLAY_LANGUAGE_OPTIONS.find(
    (option) => option.value.toLowerCase() === normalizedValue.toLowerCase()
  );
  return matchedOption?.value ?? normalizedValue;
}

function formatDisplayLanguageLabel(value: string): string {
  const normalizedValue = resolveSupportedLanguageCode(value);
  const matchedOption = DISPLAY_LANGUAGE_OPTIONS.find(
    (option) => option.value.toLowerCase() === normalizedValue.toLowerCase()
  );
  return matchedOption?.label ?? `Unknown Language (${normalizedValue})`;
}
