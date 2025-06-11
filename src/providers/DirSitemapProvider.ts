import * as vscode from 'vscode';
import * as path from 'path';
import { getSectionContent, findLineContaining } from '../utils/xmlParser';

export class DirSitemapProvider implements vscode.TreeDataProvider<XmlNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<XmlNode | undefined | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<XmlNode | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: XmlNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: XmlNode): Promise<XmlNode[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document || !editor.document.fileName.endsWith('.xml')) return [];

    const text = editor.document.getText();
    const lines = text.split('\n');
    const basePath = path.dirname(editor.document.fileName);
    const items: XmlNode[] = [];

    const resolveLineFromEntity = async (name: string, tag: string, filePattern: string) => {
      let line = findLineContaining(lines, tag, name);
      if (line === 0) {
        const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
        const usageRegex = /&(\w+);/g;
        let usageMatch;
        while ((usageMatch = usageRegex.exec(text))) {
          const entityName = usageMatch[1];
          const entityLine = findLineContaining(lines, \`&\${entityName};\`);
          const entityFileMatch = text.match(new RegExp(\`<!ENTITY\\s+\${entityName}\\s+SYSTEM\\s+"([^"]+)"\`));
          if (entityFileMatch) {
            const entityFilePath = path.resolve(basePath, entityFileMatch[1]);
            try {
              const content = await vscode.workspace.fs.readFile(vscode.Uri.file(entityFilePath));
              const contentStr = Buffer.from(content).toString('utf8');
              const pattern = new RegExp(filePattern.replace('{name}', name));
              if (pattern.test(contentStr)) return entityLine;
            } catch {}
          }
        }
      }
      return line;
    };

    if (element?.type === 'section') {
      const sectionContent = getSectionContent(text, element.label, basePath);
      if (element.label === '<fields>' || element.label === '<views>') {
        const regex = /<field\s+name\s*=\s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(sectionContent))) {
          const name = match[1];
          const line = await resolveLineFromEntity(name, '<field', '<field\\s+name\\s*=\\s*"{name}"');
          items.push(new XmlNode(\`🔹 \${name}\`, 'leaf', line));
        }
      }
      if (element.label === '<commands>') {
        const regex = /<command\s+event\s*=\s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(sectionContent))) {
          const name = match[1];
          const line = await resolveLineFromEntity(name, '<command', '<command\\s+event\\s*=\\s*"{name}"');
          items.push(new XmlNode(\`🔹 \${name}\`, 'leaf', line));
        }
      }
      if (element.label === '<response>') {
        const regex = /<action\s+id\s*=\s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(sectionContent))) {
          const name = match[1];
          const line = await resolveLineFromEntity(name, '<action', '<action\\s+id\\s*=\\s*"{name}"');
          items.push(new XmlNode(\`🔹 \${name}\`, 'leaf', line));
        }
      }
      if (element.label === '<script>') {
        const regex = /function\s+([^\s(]+)\s*\(/g;
        let match;
        while ((match = regex.exec(sectionContent))) {
          const rawName = match[1];
          const line = await resolveLineFromEntity(rawName, 'function', 'function\\s+{name}\\s*\\(');
          const icon = rawName.includes('ExecuteCommand') || rawName.includes('ResponseComplete') ? '⭐' : '🔹';
          items.push(new XmlNode(\`\${icon} \${rawName}\`, 'leaf', line));
        }
      }
      return items;
    }

    return [
      new XmlNode('<fields>', 'section'),
      new XmlNode('<views>', 'section'),
      new XmlNode('<commands>', 'section'),
      new XmlNode('<script>', 'section'),
      new XmlNode('<response>', 'section')
    ];
  }
}

class XmlNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: 'section' | 'leaf',
    public readonly line?: number
  ) {
    super(label, type === 'section' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.command = type === 'leaf' && typeof line === 'number'
      ? {
          title: 'Go to line',
          command: 'xmlSitemap.revealPosition',
          arguments: [line]
        }
      : undefined;
  }
}