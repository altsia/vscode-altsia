import { renderKatexText } from "./katex";

let visitedTextLength = 0;

export function altsia_visitor(text: string): string {
  visitedTextLength += text.length;
  return renderKatexText(text)
}

export function resetVisitedTextLength(): void {
  visitedTextLength = 0;
}

export function getVisitedTextLength(): number {
  return visitedTextLength;
}
