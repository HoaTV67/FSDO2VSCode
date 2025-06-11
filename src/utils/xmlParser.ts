import * as path from 'path';
import * as fs from 'fs';

export function getSectionContent(xmlText: string, tag: string, basePath: string): string {
  const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
  const entityMap: Record<string, string> = {};
  let entityMatch: RegExpExecArray | null;

  // Bước 1: Đọc các entity
  while ((entityMatch = entityRegex.exec(xmlText))) {
    const [, name, relPath] = entityMatch;
    try {
      const absPath = path.resolve(basePath, relPath);
      const content = fs.readFileSync(absPath, 'utf-8');
      entityMap[name] = content;
    } catch {
      entityMap[name] = `<!-- lỗi đọc entity ${name} -->`;
    }
  }

  // Bước 2: Thay entity vào xmlText
  for (let i = 0; i < 5; i++) {
    const newText = xmlText.replace(/&(\w+);/g, (_, name) => entityMap[name] || `<!-- lỗi entity ${name} không có -->`);
    if (newText === xmlText) break;
    xmlText = newText;
  }

  // Bước 3: Trích section sau khi entity đã được thay
  const cleanTag = tag.replace(/[<>]/g, '');
  const regex = new RegExp(`<${cleanTag}[^>]*>([\\s\\S]*?)<\\/${cleanTag}>`);
  const match = regex.exec(xmlText);
  return match ? match[1] : '';
}

export function findLineContaining(lines: string[], keyword: string, contain?: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(keyword) && (!contain || lines[i].includes(contain))) {
      return i;
    }
  }
  return 0;
}
