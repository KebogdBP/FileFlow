export type PdfPoint = { x: number; y: number };

export type PdfAnnotation =
  | {
      id: string;
      pageId: number;
      kind: 'text' | 'signature';
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
    }
  | {
      id: string;
      pageId: number;
      kind: 'highlight';
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }
  | {
      id: string;
      pageId: number;
      kind: 'draw';
      points: PdfPoint[];
      width: number;
      color: string;
    };

export type PdfEditSnapshot = {
  pageOrder: number[];
  rotations: Record<number, number>;
  annotations: PdfAnnotation[];
};

export function createInitialSnapshot(pageCount: number): PdfEditSnapshot {
  return {
    pageOrder: Array.from({ length: pageCount }, (_, index) => index),
    rotations: {},
    annotations: [],
  };
}

export function movePage(
  snapshot: PdfEditSnapshot,
  pageId: number,
  direction: -1 | 1,
): PdfEditSnapshot {
  const from = snapshot.pageOrder.indexOf(pageId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= snapshot.pageOrder.length) return snapshot;
  const pageOrder = [...snapshot.pageOrder];
  const movedPage = pageOrder[from];
  const displacedPage = pageOrder[to];
  if (movedPage === undefined || displacedPage === undefined) return snapshot;
  pageOrder[from] = displacedPage;
  pageOrder[to] = movedPage;
  return { ...snapshot, pageOrder };
}

export function removePage(snapshot: PdfEditSnapshot, pageId: number): PdfEditSnapshot {
  if (snapshot.pageOrder.length <= 1 || !snapshot.pageOrder.includes(pageId)) return snapshot;
  return {
    ...snapshot,
    pageOrder: snapshot.pageOrder.filter((id) => id !== pageId),
    annotations: snapshot.annotations.filter((annotation) => annotation.pageId !== pageId),
  };
}

export function rotatePage(snapshot: PdfEditSnapshot, pageId: number): PdfEditSnapshot {
  if (!snapshot.pageOrder.includes(pageId)) return snapshot;
  return {
    ...snapshot,
    rotations: {
      ...snapshot.rotations,
      [pageId]: ((snapshot.rotations[pageId] ?? 0) + 90) % 360,
    },
  };
}

export function addAnnotation(
  snapshot: PdfEditSnapshot,
  annotation: PdfAnnotation,
): PdfEditSnapshot {
  return { ...snapshot, annotations: [...snapshot.annotations, annotation] };
}

export function removeAnnotation(snapshot: PdfEditSnapshot, annotationId: string): PdfEditSnapshot {
  return {
    ...snapshot,
    annotations: snapshot.annotations.filter((annotation) => annotation.id !== annotationId),
  };
}

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function editedPdfName(name: string): string {
  const base = name.replace(/\.pdf$/i, '') || 'document';
  return `${base}-edited.pdf`;
}
