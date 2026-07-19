# M18 — Document and PDF Processing

M18 adds isolated DOCX and PDF operations to the existing safety-gated cloud worker.

## Delivered

- DOCX to PDF through headless LibreOffice;
- merge of 2–20 independently uploaded and malware-scanned PDFs;
- PDF range extraction with bounded page numbers;
- PDF compression with explicit screen, balanced and print presets;
- single-page PDF to JPEG rendering with bounded DPI and quality;
- server-owned executable paths and argument construction without a shell;
- DOCX container validation, entry-count and expanded-size ceilings before conversion;
- PDF and JPEG output signature validation before persistence;
- multi-source job persistence and clean-content checks for every merge input;
- the existing worker timeout, CPU, memory, file-size and open-file ceilings;
- temporary workspace cleanup and the existing result retention lifecycle.

The worker image owns LibreOffice Writer, qpdf, Ghostscript and Poppler. Client-provided
paths, executable flags, arbitrary page expressions and output filenames are not accepted.

`split-pdf` extracts one inclusive range into a new PDF. `pdf-to-jpg` renders one selected
page per job. Batch ranges and page collections belong to M20 batch processing.
