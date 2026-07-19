from fileflow_api.documents.handlers import DocumentHandler
from fileflow_api.media.handlers import CommandRunner
from fileflow_api.workers.contracts import OperationRegistry

DOCUMENT_OPERATIONS = (
    "docx-to-pdf",
    "merge-pdf",
    "split-pdf",
    "compress-pdf",
    "pdf-to-jpg",
)


def register_document_operations(
    registry: OperationRegistry, tools: dict[str, str], runner: CommandRunner
) -> None:
    for operation in DOCUMENT_OPERATIONS:
        registry.register(operation, DocumentHandler(tools, runner, operation))
