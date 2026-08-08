'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { FileFlowLanguage } from '../use-fileflow-language';
import {
  addAnnotation,
  clampUnit,
  createInitialSnapshot,
  editedPdfName,
  movePage,
  removeAnnotation,
  removePage,
  rotatePage,
  type PdfAnnotation,
  type PdfEditSnapshot,
  type PdfPoint,
} from './quick-pdf-model';

type Tool = 'select' | 'text' | 'highlight' | 'draw' | 'signature';
type Draft =
  { kind: 'highlight'; start: PdfPoint; end: PdfPoint } | { kind: 'draw'; points: PdfPoint[] };

const copyKeys = [
  'title',
  'private',
  'loading',
  'loadError',
  'placeholder',
  'signature',
  'tap',
  'drag',
  'draw',
  'page',
  'rotate',
  'remove',
  'left',
  'right',
  'undo',
  'redo',
  'deleteMark',
  'download',
  'exporting',
  'exportError',
  'hint',
  'emptyText',
] as const;

const copyRows: Record<FileFlowLanguage, string> = {
  en: `Select|Text|Highlight|Draw|Signature\u001fQuick PDF Editor\u001fPrivate · edits stay on this device\u001fOpening PDF…\u001fThis PDF could not be opened. It may be damaged or password-protected.\u001fText to place on the page\u001fType your signature\u001fTap the page to place it\u001fDrag across the area to highlight\u001fDraw directly on the page\u001fPage\u001fRotate\u001fDelete page\u001fMove left\u001fMove right\u001fUndo\u001fRedo\u001fDelete selected mark\u001fDownload edited PDF\u001fCreating PDF…\u001fCould not create the edited PDF.\u001fThe original is never overwritten. Added content is flattened into the downloaded copy.\u001fEnter text first.`,
  ru: `Выбор|Текст|Маркер|Рисовать|Подпись\u001fБыстрый редактор PDF\u001fПриватно · документ остаётся на устройстве\u001fОткрываем PDF…\u001fНе удалось открыть PDF. Возможно, он повреждён или защищён паролем.\u001fТекст для добавления на страницу\u001fВведите подпись\u001fНажмите на страницу, чтобы разместить\u001fПроведите по области, которую нужно выделить\u001fРисуйте прямо на странице\u001fСтраница\u001fПовернуть\u001fУдалить страницу\u001fСдвинуть влево\u001fСдвинуть вправо\u001fОтменить\u001fПовторить\u001fУдалить выбранную правку\u001fСкачать исправленный PDF\u001fСоздаём PDF…\u001fНе удалось создать исправленный PDF.\u001fОригинал не изменяется. Правки закрепляются в скачиваемой копии.\u001fСначала введите текст.`,
  es: `Seleccionar|Texto|Resaltar|Dibujar|Firma\u001fEditor rápido de PDF\u001fPrivado · el documento permanece en este dispositivo\u001fAbriendo PDF…\u001fNo se pudo abrir el PDF. Puede estar dañado o protegido con contraseña.\u001fTexto para añadir a la página\u001fEscribe tu firma\u001fToca la página para colocarlo\u001fArrastra sobre el área que quieres resaltar\u001fDibuja directamente en la página\u001fPágina\u001fGirar\u001fEliminar página\u001fMover a la izquierda\u001fMover a la derecha\u001fDeshacer\u001fRehacer\u001fEliminar marca seleccionada\u001fDescargar PDF editado\u001fCreando PDF…\u001fNo se pudo crear el PDF editado.\u001fEl original no se sobrescribe. Los cambios se fijan en la copia descargada.\u001fIntroduce texto primero.`,
};

function editorCopy(language: FileFlowLanguage) {
  const [tools = '', ...values] = copyRows[language].split('\u001f');
  const labels = Object.fromEntries(
    copyKeys.map((key, index) => [key, values[index] ?? '']),
  ) as Record<(typeof copyKeys)[number], string>;
  return { ...labels, tools: tools.split('|') };
}

const toolIds: Tool[] = ['select', 'text', 'highlight', 'draw', 'signature'];
const toolIcons = ['↖', 'T', '▰', '✎', '〽'];

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function pointFromEvent(event: React.PointerEvent<HTMLElement>): PdfPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / rect.width),
    y: clampUnit((event.clientY - rect.top) / rect.height),
  };
}

function textPng(text: string, signature: boolean): { bytes: string; aspect: number } {
  const scale = 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  const font = signature ? 'italic 52px cursive' : '600 34px sans-serif';
  context.font = font;
  const width = Math.max(80, Math.ceil(context.measureText(text).width + 24));
  const height = signature ? 76 : 54;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  context.font = font;
  context.fillStyle = '#172033';
  context.textBaseline = 'middle';
  context.fillText(text, 12, height / 2);
  return { bytes: canvas.toDataURL('image/png'), aspect: width / height };
}

export function QuickPdfEditor({ file, language }: { file: File; language: FileFlowLanguage }) {
  const text = editorCopy(language);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const [snapshot, setSnapshot] = useState<PdfEditSnapshot>();
  const [past, setPast] = useState<PdfEditSnapshot[]>([]);
  const [future, setFuture] = useState<PdfEditSnapshot[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string>();
  const [tool, setTool] = useState<Tool>('select');
  const [entry, setEntry] = useState('');
  const [draft, setDraft] = useState<Draft>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const currentPageId = snapshot?.pageOrder[selectedPage];
  const rotation = currentPageId === undefined ? 0 : (snapshot?.rotations[currentPageId] ?? 0);

  function commit(next: PdfEditSnapshot) {
    if (!snapshot || next === snapshot) return;
    setPast((items) => [...items, snapshot]);
    setSnapshot(next);
    setFuture([]);
    setSelectedAnnotation(undefined);
  }

  function undo() {
    const previous = past.at(-1);
    if (!snapshot || !previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [snapshot, ...items]);
    setSnapshot(previous);
    setSelectedPage((index) => Math.min(index, previous.pageOrder.length - 1));
  }

  function redo() {
    const next = future[0];
    if (!snapshot || !next) return;
    setPast((items) => [...items, snapshot]);
    setFuture((items) => items.slice(1));
    setSnapshot(next);
    setSelectedPage((index) => Math.min(index, next.pageOrder.length - 1));
  }

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setSnapshot(undefined);
    setPast([]);
    setFuture([]);
    setSelectedPage(0);
    void (async () => {
      try {
        const source = new Uint8Array(await file.arrayBuffer());
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const document = await pdfjs.getDocument({ data: source.slice() }).promise;
        if (cancelled) {
          await document.destroy();
          return;
        }
        bytesRef.current = source;
        pdfRef.current = document;
        setSnapshot(createInitialSnapshot(document.numPages));
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      const document = pdfRef.current;
      pdfRef.current = null;
      if (document) void document.destroy();
    };
  }, [file]);

  useEffect(() => {
    const document = pdfRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || currentPageId === undefined) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | undefined;
    void (async () => {
      const page = await document.getPage(currentPageId + 1);
      const baseViewport = page.getViewport({ scale: 1, rotation: page.rotate + rotation });
      const scale = Math.min(2.2, Math.max(1.25, 1100 / baseViewport.width));
      const viewport = page.getViewport({ scale, rotation: page.rotate + rotation });
      if (cancelled) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;
      renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise;
    })().catch((error: unknown) => {
      if (!(error instanceof Error && error.name === 'RenderingCancelledException'))
        setStatus('error');
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [currentPageId, rotation]);

  function beginPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!snapshot || currentPageId === undefined || tool === 'select') return;
    const point = pointFromEvent(event);
    if (tool === 'text' || tool === 'signature') {
      const value = entry.trim();
      if (!value) {
        setNotice(text.emptyText);
        return;
      }
      const annotation: PdfAnnotation = {
        id: crypto.randomUUID(),
        pageId: currentPageId,
        kind: tool,
        x: point.x,
        y: point.y,
        text: value,
        size: tool === 'signature' ? 0.052 : 0.035,
        color: '#172033',
      };
      commit(addAnnotation(snapshot, annotation));
      setNotice('');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(
      tool === 'highlight'
        ? { kind: 'highlight', start: point, end: point }
        : { kind: 'draw', points: [point] },
    );
  }

  function movePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!draft) return;
    const point = pointFromEvent(event);
    setDraft(
      draft.kind === 'highlight'
        ? { ...draft, end: point }
        : { ...draft, points: [...draft.points, point] },
    );
  }

  function endPointer() {
    if (!snapshot || currentPageId === undefined || !draft) return;
    if (draft.kind === 'highlight') {
      const x = Math.min(draft.start.x, draft.end.x);
      const y = Math.min(draft.start.y, draft.end.y);
      const width = Math.abs(draft.start.x - draft.end.x);
      const height = Math.abs(draft.start.y - draft.end.y);
      if (width > 0.01 && height > 0.005)
        commit(
          addAnnotation(snapshot, {
            id: crypto.randomUUID(),
            pageId: currentPageId,
            kind: 'highlight',
            x,
            y,
            width,
            height,
            color: '#ffd84d',
          }),
        );
    } else if (draft.points.length > 1) {
      commit(
        addAnnotation(snapshot, {
          id: crypto.randomUUID(),
          pageId: currentPageId,
          kind: 'draw',
          points: draft.points,
          width: 0.0035,
          color: '#ef4a5a',
        }),
      );
    }
    setDraft(undefined);
  }

  async function downloadEditedPdf() {
    if (!snapshot || !bytesRef.current) return;
    setBusy(true);
    setNotice('');
    try {
      const source = await PDFDocument.load(bytesRef.current.slice());
      const output = await PDFDocument.create();
      for (const pageId of snapshot.pageOrder) {
        const [page] = await output.copyPages(source, [pageId]);
        if (!page) throw new Error('page_copy_failed');
        output.addPage(page);
        const totalRotation =
          (((page.getRotation().angle + (snapshot.rotations[pageId] ?? 0)) % 360) + 360) % 360;
        page.setRotation(degrees(totalRotation));
        const { width, height } = page.getSize();
        for (const annotation of snapshot.annotations.filter((item) => item.pageId === pageId)) {
          if (annotation.kind === 'highlight') {
            page.drawRectangle({
              x: annotation.x * width,
              y: (1 - annotation.y - annotation.height) * height,
              width: annotation.width * width,
              height: annotation.height * height,
              color: hexToRgb(annotation.color),
              opacity: 0.36,
            });
          } else if (annotation.kind === 'draw') {
            for (let index = 1; index < annotation.points.length; index += 1) {
              const from = annotation.points[index - 1];
              const to = annotation.points[index];
              if (!from || !to) continue;
              page.drawLine({
                start: { x: from.x * width, y: (1 - from.y) * height },
                end: { x: to.x * width, y: (1 - to.y) * height },
                thickness: annotation.width * width,
                color: hexToRgb(annotation.color),
                opacity: 0.92,
              });
            }
          } else {
            const imageData = textPng(annotation.text, annotation.kind === 'signature');
            const image = await output.embedPng(imageData.bytes);
            const imageHeight = annotation.size * height;
            const imageWidth = Math.min(imageHeight * imageData.aspect, width * (1 - annotation.x));
            page.drawImage(image, {
              x: annotation.x * width,
              y: (1 - annotation.y) * height - imageHeight,
              width: imageWidth,
              height: imageHeight,
            });
          }
        }
      }
      const bytes = await output.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = editedPdfName(file.name);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setNotice(text.exportError);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading')
    return (
      <section className="quick-pdf-editor quick-pdf-state">
        <span className="inspector-spinner" />
        {text.loading}
      </section>
    );
  if (status === 'error' || !snapshot)
    return (
      <section className="quick-pdf-editor quick-pdf-state quick-pdf-error">
        {text.loadError}
      </section>
    );

  const annotations = snapshot.annotations.filter(
    (annotation) => annotation.pageId === currentPageId,
  );
  const draftStyle =
    draft?.kind === 'highlight'
      ? {
          left: `${Math.min(draft.start.x, draft.end.x) * 100}%`,
          top: `${Math.min(draft.start.y, draft.end.y) * 100}%`,
          width: `${Math.abs(draft.start.x - draft.end.x) * 100}%`,
          height: `${Math.abs(draft.start.y - draft.end.y) * 100}%`,
        }
      : undefined;

  return (
    <section className="quick-pdf-editor" aria-label={text.title}>
      <header className="quick-pdf-heading">
        <div>
          <span className="quick-pdf-badge">PDF QUICK EDIT</span>
          <h3>{text.title}</h3>
          <p>{text.private}</p>
        </div>
        <div className="quick-pdf-history">
          <button type="button" onClick={undo} disabled={!past.length} aria-label={text.undo}>
            ↶
          </button>
          <button type="button" onClick={redo} disabled={!future.length} aria-label={text.redo}>
            ↷
          </button>
        </div>
      </header>

      <div className="quick-pdf-page-strip" role="tablist" aria-label={text.page}>
        {snapshot.pageOrder.map((pageId, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={index === selectedPage}
            key={pageId}
            onClick={() => {
              setSelectedPage(index);
              setSelectedAnnotation(undefined);
            }}
          >
            <span>{index + 1}</span>
            <small>{rotation && pageId === currentPageId ? `${rotation}°` : 'PDF'}</small>
          </button>
        ))}
      </div>

      <div className="quick-pdf-toolbar" role="toolbar">
        {toolIds.map((id, index) => (
          <button
            type="button"
            key={id}
            aria-pressed={tool === id}
            onClick={() => {
              setTool(id);
              setSelectedAnnotation(undefined);
            }}
          >
            <span>{toolIcons[index]}</span>
            {text.tools[index]}
          </button>
        ))}
      </div>

      {tool === 'text' || tool === 'signature' ? (
        <div className="quick-pdf-entry">
          <input
            value={entry}
            maxLength={160}
            onChange={(event) => setEntry(event.target.value)}
            placeholder={tool === 'signature' ? text.signature : text.placeholder}
          />
          <span>{text.tap}</span>
        </div>
      ) : null}
      {tool === 'highlight' ? <p className="quick-pdf-instruction">{text.drag}</p> : null}
      {tool === 'draw' ? <p className="quick-pdf-instruction">{text.draw}</p> : null}

      <div className="quick-pdf-stage-shell">
        <div className="quick-pdf-stage">
          <canvas ref={canvasRef} />
          <div
            className={`quick-pdf-overlay tool-${tool}`}
            onPointerDown={beginPointer}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={() => setDraft(undefined)}
          >
            {annotations.map((annotation) => {
              if (annotation.kind === 'highlight')
                return (
                  <button
                    type="button"
                    aria-label={text.deleteMark}
                    key={annotation.id}
                    className="quick-pdf-highlight"
                    data-selected={selectedAnnotation === annotation.id}
                    style={{
                      left: `${annotation.x * 100}%`,
                      top: `${annotation.y * 100}%`,
                      width: `${annotation.width * 100}%`,
                      height: `${annotation.height * 100}%`,
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => tool === 'select' && setSelectedAnnotation(annotation.id)}
                  />
                );
              if (annotation.kind === 'draw')
                return (
                  <svg
                    key={annotation.id}
                    className="quick-pdf-drawing"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => tool === 'select' && setSelectedAnnotation(annotation.id)}
                  >
                    <polyline
                      points={annotation.points
                        .map((point) => `${point.x * 1000},${point.y * 1000}`)
                        .join(' ')}
                      fill="none"
                      stroke={annotation.color}
                      strokeWidth={annotation.width * 1000}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                );
              return (
                <button
                  type="button"
                  key={annotation.id}
                  className={`quick-pdf-text ${annotation.kind}`}
                  data-selected={selectedAnnotation === annotation.id}
                  style={{
                    left: `${annotation.x * 100}%`,
                    top: `${annotation.y * 100}%`,
                    fontSize: `clamp(12px, ${annotation.size * 100}vw, 38px)`,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => tool === 'select' && setSelectedAnnotation(annotation.id)}
                >
                  {annotation.text}
                </button>
              );
            })}
            {draftStyle ? <span className="quick-pdf-highlight draft" style={draftStyle} /> : null}
            {draft?.kind === 'draw' ? (
              <svg
                className="quick-pdf-drawing draft"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
              >
                <polyline
                  points={draft.points
                    .map((point) => `${point.x * 1000},${point.y * 1000}`)
                    .join(' ')}
                  fill="none"
                  stroke="#ef4a5a"
                  strokeWidth="3.5"
                />
              </svg>
            ) : null}
          </div>
        </div>
      </div>

      <div className="quick-pdf-page-actions">
        <strong>
          {text.page} {selectedPage + 1} / {snapshot.pageOrder.length}
        </strong>
        <div>
          <button
            type="button"
            disabled={selectedPage === 0}
            onClick={() =>
              currentPageId !== undefined && commit(movePage(snapshot, currentPageId, -1))
            }
            aria-label={text.left}
          >
            ←
          </button>
          <button
            type="button"
            disabled={selectedPage === snapshot.pageOrder.length - 1}
            onClick={() =>
              currentPageId !== undefined && commit(movePage(snapshot, currentPageId, 1))
            }
            aria-label={text.right}
          >
            →
          </button>
          <button
            type="button"
            onClick={() =>
              currentPageId !== undefined && commit(rotatePage(snapshot, currentPageId))
            }
          >
            {text.rotate}
          </button>
          <button
            type="button"
            disabled={snapshot.pageOrder.length === 1}
            onClick={() => {
              if (currentPageId === undefined) return;
              commit(removePage(snapshot, currentPageId));
              setSelectedPage((index) => Math.min(index, snapshot.pageOrder.length - 2));
            }}
          >
            {text.remove}
          </button>
        </div>
      </div>

      {selectedAnnotation ? (
        <button
          type="button"
          className="quick-pdf-delete-mark"
          onClick={() => commit(removeAnnotation(snapshot, selectedAnnotation))}
        >
          × {text.deleteMark}
        </button>
      ) : null}
      {notice ? (
        <p className="quick-pdf-notice" role="alert">
          {notice}
        </p>
      ) : null}
      <footer className="quick-pdf-footer">
        <p>{text.hint}</p>
        <button type="button" onClick={() => void downloadEditedPdf()} disabled={busy}>
          {busy ? text.exporting : text.download}
        </button>
      </footer>
    </section>
  );
}
