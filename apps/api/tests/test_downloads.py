from fileflow_api.downloads import attachment_disposition, converted_filename


def test_converted_filename_preserves_source_name_and_changes_extension() -> None:
    assert converted_filename("Quarterly report.pdf", ".pptx") == "Quarterly report Converted.pptx"
    assert converted_filename(r"C:\uploads\Видео: обзор.mp4", "mp3") == "Видео обзор Converted.mp3"


def test_converted_filename_does_not_duplicate_suffix() -> None:
    assert converted_filename("Document Converted.pdf", ".docx") == "Document Converted.docx"


def test_converted_filename_preserves_dots_in_link_title() -> None:
    assert (
        converted_filename("Mr. Example", ".mp4", source_is_filename=False)
        == "Mr. Example Converted.mp4"
    )


def test_attachment_disposition_supports_unicode_names() -> None:
    value = attachment_disposition("Видео обзор Converted.mp4")
    assert 'filename="Converted.mp4"' in value
    assert "filename*=UTF-8''%D0%92%D0%B8%D0%B4%D0%B5%D0%BE%20" in value
