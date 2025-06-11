import * as path from 'path';
import * as fs from 'fs';

export function getSectionContent(xmlText: string, tag: string, basePath: string): string {
  const cleanTag = tag.replace(/[<>]/g, '');
  const regex = new RegExp(`<${cleanTag}[^>]*>([\\s\\S]*?)<\\/${cleanTag}>`);
  const match = regex.exec(xmlText);
  if (!match) return '';

  let section = match[1];

  const entityRegex = /<!ENTITY\s+(\w+)\s+SYSTEM\s+"([^"]+)">/g;
  const entityMap: Record<string, string> = {};
  let entityMatch: RegExpExecArray | null;

  // Cố gắng đọc entity, nếu lỗi thì fallback chuỗi rỗng
  while ((entityMatch = entityRegex.exec(xmlText))) {
    const [, name, relPath] = entityMatch;
    try {
      const absPath = path.resolve(basePath, relPath);
      const content = fs.readFileSync(absPath, 'utf-8');
      entityMap[name] = content;
    } catch {
      entityMap[name] = `<!-- Lỗi: entity ${name} không đọc được -->`;
    }
  }

  // Thay thế entity lồng nhau tối đa 5 vòng
  for (let i = 0; i < 5; i++) {
    const newSection = section.replace(/&(\w+);/g, (_, name) => entityMap[name] || `<!-- Lỗi: entity ${name} không tìm thấy -->`);
    if (newSection === section) break;
    section = newSection;
  }

  return section;
}

export function findLineContaining(lines: string[], keyword: string, contain?: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(keyword) && (!contain || lines[i].includes(contain))) {
      return i;
    }
  }
  return 0;
}
