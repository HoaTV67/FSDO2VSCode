// Import thư viện hỗ trợ xử lý đường dẫn và file hệ thống
import * as path from 'path';
import * as fs from 'fs';

/**
 * Trích xuất nội dung bên trong một section XML (ví dụ <fields>...</fields>),
 * bao gồm cả việc thay thế entity SYSTEM như &TenEntity;
 *
 * @param xmlText - Nội dung gốc của file XML
 * @param tag - Tên thẻ cần lấy nội dung, ví dụ: '<fields>'
 * @param basePath - Thư mục chứa file XML (để xử lý entity dạng SYSTEM)
 * @returns Nội dung bên trong section (đã thay entity), hoặc chuỗi rỗng nếu không tìm thấy
 */

export function getSectionContent(xmlText: string, tag: string, basePath: string): string {
  // Regex tìm tất cả các khai báo entity dạng <!ENTITY name SYSTEM "path">
  const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;

  // Map lưu nội dung thực tế của từng entity
  const entityMap: Record<string, string> = {};

  let entityMatch: RegExpExecArray | null;

  // Bước 1: Đọc các file entity và lưu nội dung vào entityMap
  while ((entityMatch = entityRegex.exec(xmlText))) {
    const [, name, relPath] = entityMatch;
    try {
      // Tạo đường dẫn tuyệt đối đến file entity
      const absPath = path.resolve(basePath, relPath);
      // Đọc nội dung file entity (UTF-8)
      const content = fs.readFileSync(absPath, 'utf-8');
      entityMap[name] = content;
    } catch {
      // Nếu lỗi đọc file entity thì gán nội dung mô tả lỗi
      entityMap[name] = `<!-- lỗi đọc entity ${name} -->`;
    }
  }

  // Bước 2: Thay thế entity trong nội dung xmlText bằng nội dung thực tế
  for (let i = 0; i < 5; i++) {
    // Thay thế tất cả các &entityName; bằng nội dung trong entityMap
    const newText = xmlText.replace(
      /&(\w+);/g,
      (_, name) => entityMap[name] || `<!-- lỗi entity ${name} không có -->`
    );
    if (newText === xmlText) break; // Nếu không còn gì để thay thì dừng vòng lặp
    xmlText = newText;
  }

  // Bước 3: Tách nội dung của section cụ thể sau khi đã xử lý entity
  const cleanTag = tag.replace(/[<>]/g, ''); // Loại bỏ dấu < >
  const regex = new RegExp(`<${cleanTag}[^>]*>([\\s\\S]*?)<\\/${cleanTag}>`);
  const match = regex.exec(xmlText);

  // Trả về nội dung bên trong section nếu tìm thấy, ngược lại trả ''
  return match ? match[1] : '';
}

/**
 * Tìm dòng đầu tiên trong danh sách có chứa keyword (và tùy chọn thêm điều kiện chứa chuỗi phụ)
 *
 * @param lines - Mảng các dòng từ file XML
 * @param keyword - Từ khóa bắt buộc phải xuất hiện trong dòng
 * @param contain - (Tùy chọn) Chuỗi bổ sung cũng phải xuất hiện trong dòng (để lọc kỹ hơn)
 * @returns Chỉ số dòng đầu tiên phù hợp, hoặc 0 nếu không tìm thấy
 */
export function findLineContaining(lines: string[], keyword: string, contain?: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes(keyword) &&
      (!contain || lines[i].includes(contain))
    ) {
      return i; // Trả về chỉ số dòng nếu khớp điều kiện
    }
  }
  return 0; // Mặc định trả về dòng 0 nếu không tìm thấy
}
