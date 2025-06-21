import * as vscode from 'vscode';
import * as path from 'path';
import { getSectionContent, findLineContaining } from '../utils/xmlParser';

// Class chính cung cấp dữ liệu cho TreeView (sitemap cho file XML)
export class DirSitemapProvider implements vscode.TreeDataProvider<XmlNode> {
  // Event để thông báo khi tree data thay đổi
  private _onDidChangeTreeData = new vscode.EventEmitter<XmlNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Gọi hàm này để refresh lại TreeView
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // Trả về TreeItem cho từng node (XmlNode)
  getTreeItem(element: XmlNode): vscode.TreeItem {
    return element;
  }

  // Lấy các node con của một node (hoặc section gốc nếu element là undefined)
  async getChildren(element?: XmlNode): Promise<XmlNode[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document || !editor.document.fileName.endsWith('.xml')) return [];

    const text = editor.document.getText();              // Toàn bộ nội dung file XML
    const lines = text.split('\n');                      // Mỗi dòng để tiện xử lý dòng
    const basePath = path.dirname(editor.document.fileName); // Thư mục chứa file XML

    // Hàm nội bộ: tìm dòng của 1 phần tử (field, action, function...) theo tên
    const resolveLineFromEntity = async (name: string, tag: string, filePattern: string) => {
      let line = findLineContaining(lines, tag, name); // Tìm trong chính file XML
      if (line >= 0) return line;

      // Nếu không tìm được, thử tìm trong các file entity bên ngoài (dạng SYSTEM)
      const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
      let match;
      while ((match = entityRegex.exec(text))) {
        const [_, entityName, relPath] = match;
        const absPath = path.resolve(basePath, relPath); // Đường dẫn đầy đủ tới file entity
        try {
          const content = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
          const str = Buffer.from(content).toString('utf8');
          // Kiểm tra xem tên cần tìm có xuất hiện trong file này không
          if (new RegExp(filePattern.replace('{name}', name)).test(str)) {
            return findLineContaining(lines, `&${entityName};`) || 0;
          }
        } catch {}
      }
      return -1;
    };

    // Hàm tạo node từ regex → thường dùng cho field, action, command...
    const createNodesFromRegex = async (
      regex: RegExp,
      sectionContent: string,
      tag: string,
      filePattern: string
    ) => {
      const items: XmlNode[] = [];
      let match;
      while ((match = regex.exec(sectionContent))) {
        const name = match[1];
        const line = await resolveLineFromEntity(name, tag, filePattern);
        items.push(new XmlNode(name, 'leaf', line)); // Tạo leaf không có icon
      }
      return items;
    };

    // Nếu đang duyệt vào trong 1 section (ví dụ: <fields>)
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
            const label = rawName.includes('ExecuteCommand') || rawName.includes('ResponseComplete') ? `⭐ ${rawName}` : rawName;
            items.push(new XmlNode(label, 'leaf', line));
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
        const cleanTag = section.replace(/[<>]/g, '');
        const tagRegex = new RegExp(`<${cleanTag}\\b[^>]*>`, 'i');
        const line = lines.findIndex((line) => tagRegex.test(line));
        nodes.push(new XmlNode(section, 'section', line));
      }
    }

    return nodes;
  }
}

// Class đại diện cho từng node trong cây (section hoặc leaf)
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

    if (typeof line === 'number' && line >= 0) {
      this.command = {
        title: 'Go to line',
        command: 'xmlSitemap.revealPosition',
        arguments: [line]
      };
    }
  }
}
