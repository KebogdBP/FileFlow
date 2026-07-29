import os
import re
import shutil
from collections.abc import Mapping
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile

from fileflow_api.media.handlers import CommandRunner, integer_parameter, reject_unknown
from fileflow_api.workers.contracts import WorkRequest, WorkResult

DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
PDF_TYPE = "application/pdf"


class DocumentHandler:
    def __init__(self, tools: Mapping[str, str], runner: CommandRunner, operation: str) -> None:
        if any(
            not (Path(path).is_absolute() or PurePosixPath(path).is_absolute())
            for path in tools.values()
        ):
            raise ValueError("document tool paths must be absolute")
        self._tools = tools
        self._runner = runner
        self._operation = operation

    def accepts(self, content_type: str) -> bool:
        if self._operation == "docx-to-pdf":
            return content_type == DOCX_TYPE
        return content_type == PDF_TYPE

    def execute(self, request: WorkRequest) -> WorkResult:
        request.report_progress(10)
        if self._operation == "docx-to-pdf":
            self._docx_to_pdf(request)
            content_type = PDF_TYPE
        elif self._operation == "merge-pdf":
            self._merge_pdf(request)
            content_type = PDF_TYPE
        elif self._operation == "split-pdf":
            self._split_pdf(request)
            content_type = PDF_TYPE
        elif self._operation == "compress-pdf":
            self._compress_pdf(request)
            content_type = PDF_TYPE
        elif self._operation == "pdf-to-jpg":
            self._pdf_to_jpg(request)
            content_type = "image/jpeg"
        elif self._operation == "pdf-to-docx":
            self._pdf_to_docx(request)
            content_type = DOCX_TYPE
        elif self._operation == "pdf-to-pptx":
            self._pdf_to_pptx(request)
            content_type = PPTX_TYPE
        else:
            raise ValueError(f"unsupported document operation: {self._operation}")
        self._validate_output(request.output_path, content_type)
        request.report_progress(95)
        return WorkResult(content_type=content_type)

    def _docx_to_pdf(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, set())
        self._validate_docx(request.input_path)
        source = request.output_path.parent / "document.docx"
        shutil.copyfile(request.input_path, source)
        self._runner.run(
            [
                self._tools["libreoffice"],
                "--headless",
                "--nologo",
                "--nodefault",
                "--nolockcheck",
                "--nofirststartwizard",
                "--convert-to",
                "pdf",
                "--outdir",
                str(request.output_path.parent),
                str(source),
            ],
            request.output_path.parent,
        )
        os.replace(source.with_suffix(".pdf"), request.output_path)

    def _merge_pdf(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, set())
        if len(request.input_paths) < 2 or len(request.input_paths) > 20:
            raise ValueError("merge-pdf requires between 2 and 20 clean PDF sources")
        self._runner.run(
            [
                self._tools["qpdf"],
                "--empty",
                "--pages",
                *(str(path) for path in request.input_paths),
                "--",
                str(request.output_path),
            ],
            request.output_path.parent,
        )

    def _split_pdf(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, {"pages"})
        pages = request.parameters.get("pages", "all")
        if not isinstance(pages, str) or len(request.input_paths) != 1:
            raise ValueError("invalid PDF page range")
        selection = self._page_selection(pages)
        self._runner.run(
            [
                self._tools["qpdf"],
                str(request.input_path),
                "--pages",
                ".",
                selection,
                "--",
                str(request.output_path),
            ],
            request.output_path.parent,
        )

    @staticmethod
    def _page_selection(value: str) -> str:
        normalized = value.strip().lower().replace(" ", "")
        if normalized == "all":
            return "1-z"
        if not normalized or not re.fullmatch(r"\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*", normalized):
            raise ValueError("invalid PDF page selection")
        for item in normalized.split(","):
            bounds = [int(part) for part in item.split("-")]
            if any(page < 1 or page > 100_000 for page in bounds):
                raise ValueError("invalid PDF page selection")
            if len(bounds) == 2 and bounds[1] < bounds[0]:
                raise ValueError("invalid PDF page selection")
        return normalized

    def _compress_pdf(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, {"quality"})
        quality = request.parameters.get("quality", "balanced")
        presets = {"screen": "/screen", "balanced": "/ebook", "print": "/printer"}
        if not isinstance(quality, str) or quality not in presets:
            raise ValueError("invalid quality")
        self._runner.run(
            [
                self._tools["ghostscript"],
                "-dSAFER",
                "-dBATCH",
                "-dNOPAUSE",
                "-sDEVICE=pdfwrite",
                "-dCompatibilityLevel=1.7",
                f"-dPDFSETTINGS={presets[quality]}",
                f"-sOutputFile={request.output_path}",
                str(request.input_path),
            ],
            request.output_path.parent,
        )

    def _pdf_to_jpg(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, {"page", "dpi", "quality"})
        page = integer_parameter(request.parameters, "page", 1, range(1, 100_001))
        dpi = integer_parameter(request.parameters, "dpi", 150, {72, 150, 300})
        quality = integer_parameter(request.parameters, "quality", 85, range(40, 96))
        self._runner.run(
            [
                self._tools["pdftoppm"],
                "-f",
                str(page),
                "-l",
                str(page),
                "-singlefile",
                "-r",
                str(dpi),
                "-jpeg",
                "-jpegopt",
                f"quality={quality}",
                str(request.input_path),
                str(request.output_path),
            ],
            request.output_path.parent,
        )
        os.replace(request.output_path.with_suffix(".jpg"), request.output_path)

    def _pdf_to_docx(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, set())
        text_path = request.output_path.parent / "document.txt"
        self._runner.run(
            [
                self._tools["pdftotext"],
                "-layout",
                "-nopgbrk",
                str(request.input_path),
                str(text_path),
            ],
            request.output_path.parent,
        )
        self._runner.run(
            [
                self._tools["libreoffice"],
                "--headless",
                "--nologo",
                "--nodefault",
                "--nolockcheck",
                "--nofirststartwizard",
                "--convert-to",
                "docx:Office Open XML Text",
                "--outdir",
                str(request.output_path.parent),
                str(text_path),
            ],
            request.output_path.parent,
        )
        os.replace(text_path.with_suffix(".docx"), request.output_path)

    def _pdf_to_pptx(self, request: WorkRequest) -> None:
        reject_unknown(request.parameters, set())
        source = request.output_path.parent / "document.pdf"
        shutil.copyfile(request.input_path, source)
        self._runner.run(
            [
                self._tools["libreoffice"],
                "--headless",
                "--nologo",
                "--nodefault",
                "--nolockcheck",
                "--nofirststartwizard",
                "--convert-to",
                "pptx:Impress MS PowerPoint 2007 XML",
                "--outdir",
                str(request.output_path.parent),
                str(source),
            ],
            request.output_path.parent,
        )
        os.replace(source.with_suffix(".pptx"), request.output_path)

    @staticmethod
    def _validate_docx(path: Path) -> None:
        try:
            with ZipFile(path) as archive:
                names = set(archive.namelist())
                if len(names) > 10_000:
                    raise ValueError("DOCX contains too many entries")
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    raise ValueError("input is not a DOCX document")
                if sum(item.file_size for item in archive.infolist()) > 512 * 1024 * 1024:
                    raise ValueError("expanded DOCX exceeds safety limit")
        except BadZipFile as error:
            raise ValueError("input is not a valid DOCX document") from error

    @staticmethod
    def _validate_output(path: Path, content_type: str) -> None:
        with path.open("rb") as output:
            header = output.read(8)
        if content_type == PDF_TYPE and not header.startswith(b"%PDF-"):
            raise ValueError("document tool returned an unexpected PDF signature")
        if content_type == "image/jpeg" and not header.startswith(b"\xff\xd8\xff"):
            raise ValueError("document tool returned an unexpected JPEG signature")
        if content_type == DOCX_TYPE:
            DocumentHandler._validate_office_output(path, "word/document.xml", "DOCX")
        if content_type == PPTX_TYPE:
            DocumentHandler._validate_office_output(path, "ppt/presentation.xml", "PPTX")

    @staticmethod
    def _validate_office_output(path: Path, required_entry: str, label: str) -> None:
        try:
            with ZipFile(path) as archive:
                names = set(archive.namelist())
                if "[Content_Types].xml" not in names or required_entry not in names:
                    raise ValueError(f"document tool returned an invalid {label} package")
                if len(names) > 10_000:
                    raise ValueError(f"document tool returned an oversized {label} package")
                if sum(item.file_size for item in archive.infolist()) > 512 * 1024 * 1024:
                    raise ValueError(f"expanded {label} exceeds safety limit")
        except BadZipFile as error:
            raise ValueError(f"document tool returned an invalid {label} package") from error
