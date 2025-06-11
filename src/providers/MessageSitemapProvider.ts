import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { findLineContaining } from '../utils/xmlParser';

export class MessageSitemapProvider implements vscode.TreeDataProvider<XmlNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<XmlNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: XmlNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: XmlNode): Promise<XmlNode[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document || !editor.document.fileName.toLowerCase().endsWith('message.xml')) return [];

    const text = editor.document.getText();
    const lines = text.split('\n');
    const basePath = path.dirname(editor.document.fileName);

    const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
    const entityMap: Record<string, string> = {};
    let match;

    while ((match = entityRegex.exec(text))) {
      const [, name, relPath] = match;
      try {
        const absPath = path.resolve(basePath, relPath);
        const content = fs.readFileSync(absPath, 'utf-8');
        entityMap[name] = content;
      } catch {
        entityMap[name] = '';
      }
    }

    let xmlText = text;
    for (let i = 0; i < 5; i++) {
      const newText = xmlText.replace(/&(\w+);/g, (_, name) => entityMap[name] || '');
      if (newText === xmlText) break;
      xmlText = newText;
    }

    if (!element) {
      return [new XmlNode('<action>', 'section')];
    }

    if (element.label === '<action>') {
      const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/.exec(xmlText);
      if (!templateMatch) return [];

      const templateContent = templateMatch[1];
      const actionRegex = /<action\s+id="([^"]+)"/g;
      const items: XmlNode[] = [];

      while ((match = actionRegex.exec(templateContent))) {
        const id = match[1];
        const line = findLineContaining(lines, `id="${id}"`);
        items.push(new XmlNode(`🔹 ${id}`, 'leaf', line));
      }

      return items;
    }

    return [];
  }
}

class XmlNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: 'section' | 'leaf',
    public readonly line?: number
  ) {
    super(
      label,
      type === 'section'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.command =
      type === 'leaf' && typeof line === 'number'
        ? {
            title: 'Go to line',
            command: 'xmlSitemap.revealPosition',
            arguments: [line]
          }
        : undefined;
  }
}
