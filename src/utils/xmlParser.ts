import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function getSectionContent(sectionName: string, lines: string[]): string | null {
  const startTag = `<${sectionName}>`;
  const endTag = `</${sectionName}>`;
  const startIndex = lines.findIndex(line => line.includes(startTag));
  const endIndex = lines.findIndex(line => line.includes(endTag));
  if (startIndex >= 0 && endIndex >= 0 && endIndex > startIndex) {
    return lines.slice(startIndex, endIndex + 1).join('\n');
  }
  return null;
}

export function findLineContaining(text: string, lines: string[]): number {
  return lines.findIndex(line => line.includes(text));
}

export function findEntityReferenceLine(name: string, lines: string[], section: string): number {
  const directLine = lines.findIndex(line => line.includes('<field') && line.includes(`name="${name}"`));
  if (directLine >= 0) return directLine;

  const entityLine = lines.find(line =>
    line.includes('<!ENTITY') && line.includes('SYSTEM') && line.includes(section)
  );

  if (entityLine) {
    const match = entityLine.match(/<!ENTITY\s+(\w+)\s+SYSTEM\s+\"([^\"]+)\"/);
    if (match) {
      const entityName = match[1];
      const filePath = path.resolve(path.dirname(vscode.window.activeTextEditor!.document.fileName), match[2]);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8').split('\n');
        const resolvedLine = content.findIndex(line => line.includes('<field') && line.includes(`name="${name}"`));
        if (resolvedLine >= 0) {
          return lines.findIndex(line => line.includes(`&${entityName};`));
        }
      }
    }
  }

  return -1;
}
