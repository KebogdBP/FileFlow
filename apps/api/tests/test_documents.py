from collections.abc import Sequence
from pathlib import Path
from zipfile import ZipFile

import pytest

from fileflow_api.documents.handlers import DOCX_TYPE, DocumentHandler
from fileflow_api.documents.registry import DOCUMENT_OPERATIONS, register_document_operations
from fileflow_api.workers.contracts import OperationRegistry, WorkRequest

TOOLS = {
    "libreoffice": "/usr/bin/libreoffice",
    "pdftotext": "/usr/bin/pdftotext",
    "qpdf": "/usr/bin/qpdf",
    "ghostscript": "/usr/bin/gs",
    "pdftoppm": "/usr/bin/pdftoppm",
}


class RecordingRunner:
    def __init__(self) -> None:
        self.commands: list[list[str]] = []

    def run(self, argv: Sequence[str], workspace: Path) -> None:
        command = list(argv)
        self.commands.append(command)
        if command[0] == TOOLS["libreoffice"]:
            source_suffix = Path(command[-1]).suffix
            if source_suffix == ".docx":
                (workspace / "document.pdf").write_bytes(b"%PDF-1.7\nresult")
            elif source_suffix == ".txt":
                with ZipFile(workspace / "document.docx", "w") as archive:
                    archive.writestr("[Content_Types].xml", "types")
                    archive.writestr("word/document.xml", "document")
            elif source_suffix == ".pdf":
                with ZipFile(workspace / "document.pptx", "w") as archive:
                    archive.writestr("[Content_Types].xml", "types")
                    archive.writestr("ppt/presentation.xml", "presentation")
        elif command[0] == TOOLS["pdftotext"]:
            Path(command[-1]).write_text("Editable PDF text", encoding="utf-8")
        elif command[0] == TOOLS["pdftoppm"]:
            Path(f"{command[-1]}.jpg").write_bytes(b"\xff\xd8\xffresult")
        else:
            output = next(
                (
                    Path(value.removeprefix("-sOutputFile="))
                    for value in command
                    if value.startswith("-sOutputFile=")
                ),
                Path(command[-1]),
            )
            output.write_bytes(b"%PDF-1.7\nresult")


def pdf_request(
    tmp_path: Path,
    parameters: dict[str, str | int] | None = None,
    source_count: int = 1,
) -> WorkRequest:
    sources = []
    for index in range(source_count):
        source = tmp_path / f"source-{index}"
        source.write_bytes(b"%PDF-1.7\nsource")
        sources.append(source)
    return WorkRequest(
        input_path=sources[0],
        input_paths=tuple(sources),
        output_path=tmp_path / "result",
        parameters=parameters or {},
        report_progress=lambda _: None,
    )


def test_docx_conversion_validates_container_and_uses_server_owned_command(tmp_path: Path) -> None:
    source = tmp_path / "source"
    with ZipFile(source, "w") as archive:
        archive.writestr("[Content_Types].xml", "types")
        archive.writestr("word/document.xml", "document")
    runner = RecordingRunner()
    result = DocumentHandler(TOOLS, runner, "docx-to-pdf").execute(
        WorkRequest(source, (source,), tmp_path / "result", {}, lambda _: None)
    )
    assert result.content_type == "application/pdf"
    assert runner.commands[0][0] == "/usr/bin/libreoffice"
    assert "--headless" in runner.commands[0]


def test_merge_requires_multiple_clean_materialized_sources(tmp_path: Path) -> None:
    runner = RecordingRunner()
    result = DocumentHandler(TOOLS, runner, "merge-pdf").execute(
        pdf_request(tmp_path, source_count=3)
    )
    assert result.content_type == "application/pdf"
    assert runner.commands[0][1:3] == ["--empty", "--pages"]
    with pytest.raises(ValueError, match="between 2 and 20"):
        DocumentHandler(TOOLS, runner, "merge-pdf").execute(pdf_request(tmp_path))


@pytest.mark.parametrize(
    ("operation", "content_type", "tool"),
    [
        ("pdf-to-docx", DOCX_TYPE, "/usr/bin/pdftotext"),
        (
            "pdf-to-pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "/usr/bin/libreoffice",
        ),
    ],
)
def test_pdf_converts_to_editable_office_formats(
    tmp_path: Path, operation: str, content_type: str, tool: str
) -> None:
    runner = RecordingRunner()
    result = DocumentHandler(TOOLS, runner, operation).execute(pdf_request(tmp_path))
    assert result.content_type == content_type
    assert runner.commands[0][0] == tool
    assert all('"' not in argument for command in runner.commands for argument in command)


@pytest.mark.parametrize(
    ("operation", "parameters", "tool"),
    [
        ("split-pdf", {"pages": "2,4-6"}, "/usr/bin/qpdf"),
        ("compress-pdf", {"quality": "balanced"}, "/usr/bin/gs"),
        ("pdf-to-jpg", {"page": 2, "dpi": 150, "quality": 80}, "/usr/bin/pdftoppm"),
    ],
)
def test_pdf_operations_have_bounded_parameters(
    tmp_path: Path, operation: str, parameters: dict[str, str | int], tool: str
) -> None:
    runner = RecordingRunner()
    DocumentHandler(TOOLS, runner, operation).execute(pdf_request(tmp_path, parameters))
    assert runner.commands[0][0] == tool


@pytest.mark.parametrize(
    ("operation", "parameters"),
    [
        ("split-pdf", {"pages": "0,2"}),
        ("split-pdf", {"pages": "4-2"}),
        ("compress-pdf", {"quality": "$(whoami)"}),
        ("pdf-to-jpg", {"dpi": 1200}),
        ("pdf-to-jpg", {"unexpected": "value"}),
    ],
)
def test_untrusted_document_parameters_never_become_arguments(
    tmp_path: Path, operation: str, parameters: dict[str, str | int]
) -> None:
    runner = RecordingRunner()
    with pytest.raises(ValueError, match="invalid"):
        DocumentHandler(TOOLS, runner, operation).execute(pdf_request(tmp_path, parameters))
    assert runner.commands == []


def test_document_registry_exposes_reviewed_operations_and_types() -> None:
    registry = OperationRegistry()
    register_document_operations(registry, TOOLS, RecordingRunner())
    assert all(registry.resolve(operation) is not None for operation in DOCUMENT_OPERATIONS)
    assert registry.resolve("docx-to-pdf").accepts(DOCX_TYPE)  # type: ignore[union-attr]


@pytest.mark.parametrize(("pages", "expected"), [("all", "1-z"), ("1,3-5", "1,3-5")])
def test_pdf_page_extraction_supports_all_or_selected_pages(
    tmp_path: Path, pages: str, expected: str
) -> None:
    runner = RecordingRunner()
    DocumentHandler(TOOLS, runner, "split-pdf").execute(pdf_request(tmp_path, {"pages": pages}))
    command = runner.commands[0]
    assert command[command.index(".") + 1] == expected
