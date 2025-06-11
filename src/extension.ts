import * as vscode from 'vscode';
import { DirSitemapProvider } from './providers/DirSitemapProvider';
import { MessageSitemapProvider } from './providers/MessageSitemapProvider';

export function activate(context: vscode.ExtensionContext) {
  const treeViewId = 'xmlSitemap';
  let activeProvider: vscode.TreeDataProvider<any>;

  // function getProviderForFile(filename: string): vscode.TreeDataProvider<any> {
    // if (filename.endsWith('message.xml')) return new MessageSitemapProvider();
    // return new DirSitemapProvider();
  // }
	function getProviderForFile(filename: string): vscode.TreeDataProvider<any> {
	  const lower = filename.toLowerCase();
	  console.log('[DEBUG] Đang chọn provider cho file:', lower);
	  if (lower.endsWith('message.xml')) {
		console.log('[DEBUG] Chọn MessageSitemapProvider');
		return new MessageSitemapProvider();
	  }
	  console.log('[DEBUG] Chọn DirSitemapProvider');
	  return new DirSitemapProvider();
	}



  function registerDynamicProvider(editor: vscode.TextEditor | undefined) {
    if (!editor || !editor.document.fileName.endsWith('.xml')) return;
    const provider = getProviderForFile(editor.document.fileName);
    activeProvider = provider;
    vscode.window.registerTreeDataProvider(treeViewId, provider);
    provider.refresh?.();
  }

  registerDynamicProvider(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      registerDynamicProvider(editor);
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
