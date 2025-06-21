// Import các module cần thiết
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { findLineContaining } from '../utils/xmlParser';

// Class cung cấp dữ liệu sitemap cho file message.xml
export class MessageSitemapProvider implements vscode.TreeDataProvider<XmlNode> {
  // Khai báo sự kiện thay đổi dữ liệu trong cây
  private _onDidChangeTreeData = new vscode.EventEmitter<XmlNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Gọi khi cần làm mới cây sitemap (ví dụ khi chuyển file)
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // Trả về node (TreeItem) cho 1 phần tử trong cây
  getTreeItem(element: XmlNode): vscode.TreeItem {
    return element;
  }

  // Lấy các node con trong cây (tùy theo context là root hay trong section <action>)
  async getChildren(element?: XmlNode): Promise<XmlNode[]> {
    const editor = vscode.window.activeTextEditor;

    // Chỉ xử lý nếu file đang mở là message.xml
    if (!editor || !editor.document || !editor.document.fileName.toLowerCase().endsWith('message.xml')) return [];

    const text = editor.document.getText();                   // Lấy toàn bộ nội dung file XML
    const lines = text.split('\n');                           // Tách ra từng dòng để tìm dòng số
    const basePath = path.dirname(editor.document.fileName);  // Lấy thư mục chứa file đang mở

    // Tìm tất cả các khai báo entity bên ngoài file chính
    const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
    const entityMap: Record<string, string> = {};             // Map tên entity => nội dung file
    let match;

    // Đọc nội dung của từng file được khai báo trong entity
    while ((match = entityRegex.exec(text))) {
      const [, name, relPath] = match;
      try {
        const absPath = path.resolve(basePath, relPath);      // Tạo đường dẫn đầy đủ đến file
        const content = fs.readFileSync(absPath, 'utf-8');    // Đọc nội dung file
        entityMap[name] = content;
      } catch {
        entityMap[name] = ''; // Nếu lỗi đọc file thì gán rỗng
      }
    }

    // Thay thế tất cả entity (dạng &entity;) trong text gốc thành nội dung thực
    let xmlText = text;
    for (let i = 0; i < 5; i++) { // Thay tối đa 5 vòng để xử lý entity lồng nhau
      const newText = xmlText.replace(/&(\w+);/g, (_, name) => entityMap[name] || '');
      if (newText === xmlText) break; // Dừng nếu không còn gì để thay nữa
      xmlText = newText;
    }

    // Nếu chưa truyền vào node nào → đang ở gốc → trả về node section <action>
    if (!element) {
      return [new XmlNode('<action>', 'section')];
    }

    // Nếu đang mở section <action> → tìm các thẻ <action id="..."> bên trong template
    if (element.label === '<action>') {
      const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/.exec(xmlText); // Lấy nội dung trong <template>...</template>
      if (!templateMatch) return [];

      const templateContent = templateMatch[1]; // Phần nội dung bên trong template
      const actionRegex = /<action\s+id="([^"]+)"/g; // Regex tìm thẻ <action id="...">
      const items: XmlNode[] = [];

      // Với mỗi action tìm được → tạo node leaf và xác định dòng
      while ((match = actionRegex.exec(templateContent))) {
        const id = match[1];
        const line = findLineContaining(lines, `id="${id}"`); // Tìm dòng chứa action này
        items.push(new XmlNode(`🔹 ${id}`, 'leaf', line));     // Thêm node vào danh sách
      }

      return items; // Trả về danh sách node <action>
    }

    return []; // Trường hợp không khớp gì → trả về rỗng
  }
}

// Định nghĩa node XmlNode để dùng cho từng phần tử trong sitemap
class XmlNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,                   // Label hiển thị trong cây
    public readonly type: 'section' | 'leaf',        // Loại node: section hay leaf
    public readonly line?: number                    // Dòng tương ứng (nếu có)
  ) {
    super(
      label,
      type === 'section'
        ? vscode.TreeItemCollapsibleState.Collapsed  // Section có thể mở rộng
        : vscode.TreeItemCollapsibleState.None       // Leaf là node cuối cùng
    );

    // Nếu là leaf → thêm command để nhảy đến dòng khi click
    this.command =
      type === 'leaf' && typeof line === 'number'
        ? {
            title: 'Go to line',
            command: 'xmlSitemap.revealPosition',     // Lệnh sẽ được gọi khi click
            arguments: [line]                         // Truyền dòng để focus
          }
        : undefined;
  }
}
