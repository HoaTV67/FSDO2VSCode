import * as vscode from 'vscode';
import * as path from 'path';
import { getSectionContent, findLineContaining } from '../utils/xmlParser';

export class DirSitemapProvider implements vscode.TreeDataProvider<XmlNode> {
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
    if (!editor || !editor.document || !editor.document.fileName.endsWith('.xml')) return [];

    const text = editor.document.getText();
    const lines = text.split('\n');
    const basePath = path.dirname(editor.document.fileName);

    const resolveLineFromEntity = async (name: string, tag: string, filePattern: string) => {
      let line = findLineContaining(lines, tag, name);
      if (line > 0) return line;

      const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
      let match;
      while ((match = entityRegex.exec(text))) {
        const [_, entityName, relPath] = match;
        const absPath = path.resolve(basePath, relPath);
        try {
          const content = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
          const str = Buffer.from(content).toString('utf8');
          if (new RegExp(filePattern.replace('{name}', name)).test(str)) {
            return findLineContaining(lines, `&${entityName};`) || 0;
          }
        } catch {}
      }
      return 0;
    };

    const createNodesFromRegex = async (
      regex: RegExp,
      sectionContent: string,
      tag: string,
      filePattern: string,
      icon = '🔹'
    ) => {
      const items: XmlNode[] = [];
      let match;
      while ((match = regex.exec(sectionContent))) {
        const name = match[1];
        const line = await resolveLineFromEntity(name, tag, filePattern);
        items.push(new XmlNode(`${icon} ${name}`, 'leaf', line));
      }
      return items;
    };

    if (element?.type === 'section') {
      const section = getSectionContent(text, element.label, basePath);
      const map: Record<string, () => Promise<XmlNode[]>> = {
        '<fields>': () =>
          createNodesFromRegex(/<field\s+name\s*=\s*"([^"]+)"/g, section, '<field', '<field\\s+name\\s*=\\s*"{name}"'),
        '<views>': () =>
          createNodesFromRegex(/<field\s+name\s*=\s*"([^"]+)"/g, section, '<field', '<field\\s+name\\s*=\\s*"{name}"'),
        '<commands>': () =>
          createNodesFromRegex(/<command\s+event\s*=\s*"([^"]+)"/g, section, '<command', '<command\\s+event\\s*=\\s*"{name}"'),
        '<response>': () =>
          createNodesFromRegex(/<action\s+id\s*=\s*"([^"]+)"/g, section, '<action', '<action\\s+id\\s*=\\s*"{name}"'),
        '<script>': async () => {
          const regex = /function\s+([^\s(]+)\s*\(/g;
          const items: XmlNode[] = [];
          let match;
          while ((match = regex.exec(section))) {
            const rawName = match[1];
            const line = await resolveLineFromEntity(rawName, 'function', 'function\\s+{name}\\s*\\(');
            const icon = rawName.includes('ExecuteCommand') || rawName.includes('ResponseComplete') ? '⭐' : '🔹';
            items.push(new XmlNode(`${icon} ${rawName}`, 'leaf', line));
          }
          return items;
        }
      };
      return map[element.label]?.() || [];
    }

    
    const sectionNames = ['<fields>', '<views>', '<commands>', '<script>', '<response>'];
    const nodes: XmlNode[] = [];

    for (const section of sectionNames) {
      const content = getSectionContent(text, section, basePath);
      if (content && content.trim().length > 0) {
        nodes.push(new XmlNode(section, 'section'));
      }
    }

    return nodes;

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
