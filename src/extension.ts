import * as vscode from 'vscode';
import { DirSitemapProvider } from './providers/DirSitemapProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new DirSitemapProvider();

  vscode.window.registerTreeDataProvider('xmlSitemap', provider);

  vscode.commands.registerCommand('xmlSitemap.refresh', () => provider.refresh());

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'xml') {
        provider.refresh();
      }
    })
  );

  vscode.commands.registerCommand('xmlSitemap.revealPosition', async (line: number) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const doc = editor.document;
    const targetEditor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    const position = new vscode.Position(line, 0);
    const selection = new vscode.Selection(position, position);
    targetEditor.selection = selection;
    targetEditor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  });
}

export function deactivate() {}