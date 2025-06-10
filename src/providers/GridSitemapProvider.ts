import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSectionContent, findLineContaining } from '../utils/xmlParser';

export class GridSitemapProvider implements vscode.TreeDataProvider<XmlNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<XmlNode | undefined | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<XmlNode | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: XmlNode): vscode.TreeItem {
  if (element.children && element.children.length > 0) {
    element.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  }
  return element;
}

  async getChildren(element?: XmlNode): Promise<XmlNode[]> {
    if (element?.type === 'js.function' && element.children) {
      return element.children;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document || !editor.document.fileName.endsWith('.xml')) return [];

    const text = editor.document.getText();
    const lines = text.split('\n');
    const basePath = path.dirname(editor.document.fileName);

    const findEntityReferenceLine = (name: string, section: string): number => {
      const directLine = lines.findIndex(line => line.includes('<field') && line.includes(`name="${name}"`));
      if (directLine >= 0) return directLine;

      const entityLine = lines.find(line =>
        line.includes('<!ENTITY') && line.includes('SYSTEM') && line.includes(section)
      );

      if (entityLine) {
        const match = entityLine.match(/SYSTEM\s+\"([^\"]+)\"/);
        if (match) {
          const filePath = path.resolve(basePath, match[1]);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8').split('\n');
            const resolvedLine = content.findIndex(line => line.includes('<field') && line.includes(`name="${name}"`));
            if (resolvedLine >= 0) {
              return lines.findIndex(line => line.includes(`&${path.basename(filePath, '.txt')};`));
            }
          }
        }
      }

      return -1;
    };

    if (!element) {
      return ['fields', 'views', 'commands', 'script', 'response', 'queries'].map(
        section => new XmlNode(section, vscode.TreeItemCollapsibleState.Collapsed, 'section')
      );
    }

    const sectionName = element.label;
    const content = getSectionContent(sectionName, lines);
    if (!content) return [];

    if (sectionName === 'fields' || sectionName === 'queries') {
      const fieldNodes = [...content.matchAll(/<field[^>]+name\s*=\s*"([^"]+)"/g)].map(m => m[1]);
      return fieldNodes.map(name => {
        const line = findEntityReferenceLine(name, sectionName);
        return new XmlNode(name, vscode.TreeItemCollapsibleState.None, 'field', line);
      });
    }

    if (sectionName === 'views') {
      const views = [...content.matchAll(/<view[^>]+id\s*=\s*"([^"]+)"/g)].map(m => m[1]);
      return views.map(viewId => new XmlNode(viewId, vscode.TreeItemCollapsibleState.Collapsed, 'view'));
    }

    if (element.type === 'view') {
      const viewId = element.label;
      const viewBlock = content.match(new RegExp(`<view[^>]+id="${viewId}"[\s\S]*?<\/view>`));
      if (!viewBlock) return [];
      const fieldNodes = [...viewBlock[0].matchAll(/<field[^>]+name\s*=\s*"([^"]+)"/g)].map(m => m[1]);
      return fieldNodes.map(name => {
        const line = findEntityReferenceLine(name, 'views');
        return new XmlNode(name, vscode.TreeItemCollapsibleState.None, 'view.field', line);
      });
    }

    if (['commands', 'script', 'response'].includes(sectionName)) {
      const subnodes: XmlNode[] = [];

      if (sectionName === 'response') {
        const actions = [...content.matchAll(/<action[^>]+id\s*=\s*"([^"]+)"/g)].map(m => m[1]);
        for (const id of actions) {
          const line = findLineContaining(`id="${id}"`, lines);
          subnodes.push(new XmlNode(`action: ${id}`, vscode.TreeItemCollapsibleState.None, 'response.action', line));
        }
      }

      const functionRegex = /function\s+(on\$[\w$]+(?:ExecuteCommand|ResponseComplete))\s*\([^)]*\)\s*\{/g;
      let match;
      while ((match = functionRegex.exec(text)) !== null) {
        const funcName = match[1];
        const funcStartIndex = match.index;
        const funcLine = findLineContaining(`function ${funcName}`, lines);

        let braceCount = 0;
        let bodyStart = text.indexOf('{', funcStartIndex);
        let i = bodyStart + 1;
        while (i < text.length) {
          if (text[i] === '{') braceCount++;
          else if (text[i] === '}') {
            if (braceCount === 0) break;
            braceCount--;
          }
          i++;
        }
        const body = text.slice(bodyStart + 1, i);

        const node = new XmlNode(funcName, vscode.TreeItemCollapsibleState.Collapsed, 'js.function', funcLine);
node.children = [];

const caseMatches = [...body.matchAll(/case\s+'([^']+)'/g)];
        for (const caseMatch of caseMatches) {
          const caseLabel = caseMatch[1];
          const line = findLineContaining(`case '${caseLabel}'`, lines);
          node.children = node.children || [];
          node.children.push(new XmlNode(`case '${caseLabel}'`, vscode.TreeItemCollapsibleState.None, 'js.case', line));
        }

        subnodes.push(node);
      }

      return subnodes;
    }

    return [];
  }
}

export class XmlNode extends vscode.TreeItem {
  children?: XmlNode[];

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string,
    public readonly line?: number
  ) {
    super(label, collapsibleState);
    if (line !== undefined) {
      this.command = {
        command: 'vscode.open',
        title: 'Open XML Node',
        arguments: [vscode.window.activeTextEditor?.document.uri, { selection: new vscode.Range(line, 0, line, 0) }]
      };
    }
  }

  contextValue = 'xmlNode';
}
