import type { CarouselCardDraft } from './templateBuilder';

export interface ValidationIssue {
  path: string;
  message: string;
}

export function findIssue(issues: ValidationIssue[], prefix: string) {
  return issues.find((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`))?.message;
}

export function collectIssues(issues: ValidationIssue[], prefix: string) {
  return issues.filter((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`));
}

export function updateCarouselCard(
  cards: CarouselCardDraft[],
  index: number,
  patch: Partial<CarouselCardDraft>
) {
  return cards.map((card, cardIndex) => (cardIndex === index ? { ...card, ...patch } : card));
}
