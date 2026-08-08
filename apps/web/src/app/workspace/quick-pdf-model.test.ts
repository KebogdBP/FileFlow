import { describe, expect, it } from 'vitest';
import {
  addAnnotation,
  createInitialSnapshot,
  editedPdfName,
  movePage,
  removePage,
  rotatePage,
} from './quick-pdf-model';

describe('quick PDF edit model', () => {
  it('moves, rotates, and removes pages without mutating the original snapshot', () => {
    const initial = createInitialSnapshot(3);
    const moved = movePage(initial, 0, 1);
    const rotated = rotatePage(moved, 0);
    const removed = removePage(rotated, 2);

    expect(initial.pageOrder).toEqual([0, 1, 2]);
    expect(removed.pageOrder).toEqual([1, 0]);
    expect(removed.rotations[0]).toBe(90);
  });

  it('removes annotations with their page and keeps at least one page', () => {
    const withMark = addAnnotation(createInitialSnapshot(2), {
      id: 'mark',
      pageId: 1,
      kind: 'highlight',
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.1,
      color: '#ffd84d',
    });
    const onePage = removePage(withMark, 1);

    expect(onePage.annotations).toEqual([]);
    expect(removePage(onePage, 0)).toBe(onePage);
  });

  it('creates a safe edited filename', () => {
    expect(editedPdfName('report.PDF')).toBe('report-edited.pdf');
    expect(editedPdfName('.pdf')).toBe('document-edited.pdf');
  });
});
