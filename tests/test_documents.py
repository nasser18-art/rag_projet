"""Validation, extraction et découpage — sans réseau, sans modèle."""

from __future__ import annotations

import unittest

from rag.documents import (
    EmptyDocument,
    ExtractionFailed,
    FileTooLarge,
    UnsupportedFormat,
    chunk_pages,
    clean_text,
    extension_of,
    extract_pages,
    sanitize_filename,
    sha256_of,
    validate_upload,
)

from .factories import make_csv, make_docx, make_pdf, make_xlsx


class NamingTests(unittest.TestCase):
    def test_extension_is_normalised(self) -> None:
        self.assertEqual(extension_of("Contrat.PDF"), "pdf")
        self.assertEqual(extension_of("archive.tar.gz"), "gz")
        self.assertEqual(extension_of("sansextension"), "")

    def test_sanitize_strips_paths_and_control_characters(self) -> None:
        self.assertEqual(sanitize_filename("../../etc/passwd"), "passwd")
        self.assertEqual(sanitize_filename(r"C:\Users\x\Contrat Atlas.pdf"), "Contrat Atlas.pdf")
        self.assertEqual(sanitize_filename("nom\x00avec\x1fcontrole.pdf"), "nomaveccontrole.pdf")
        self.assertEqual(sanitize_filename(".cache.pdf"), "cache.pdf")

    def test_sanitize_rejects_empty(self) -> None:
        with self.assertRaises(UnsupportedFormat):
            sanitize_filename("///")

    def test_sanitize_caps_length(self) -> None:
        name = sanitize_filename("a" * 300 + ".pdf")
        self.assertLessEqual(len(name), 160)
        self.assertTrue(name.endswith(".pdf"))


class ValidationTests(unittest.TestCase):
    def test_unknown_extension_is_refused(self) -> None:
        with self.assertRaises(UnsupportedFormat):
            validate_upload("script.exe", b"MZ", max_bytes=1024)

    def test_empty_file_is_refused(self) -> None:
        with self.assertRaises(EmptyDocument):
            validate_upload("vide.pdf", b"", max_bytes=1024)

    def test_oversized_file_is_refused(self) -> None:
        with self.assertRaises(FileTooLarge):
            validate_upload("gros.pdf", b"%PDF" + b"0" * 2048, max_bytes=1024)

    def test_signature_mismatch_is_refused(self) -> None:
        with self.assertRaises(UnsupportedFormat):
            validate_upload("faux.pdf", b"Ceci n'est pas un PDF", max_bytes=1024)
        with self.assertRaises(UnsupportedFormat):
            validate_upload("faux.docx", b"pas un zip", max_bytes=1024)

    def test_valid_signatures_pass(self) -> None:
        self.assertEqual(validate_upload("ok.pdf", make_pdf(["Bonjour"]), max_bytes=10_000), "pdf")
        self.assertEqual(validate_upload("ok.docx", make_docx(["Bonjour"]), max_bytes=200_000), "docx")

    def test_sha256_is_stable(self) -> None:
        payload = b"contenu"
        self.assertEqual(sha256_of(payload), sha256_of(b"contenu"))
        self.assertNotEqual(sha256_of(payload), sha256_of(b"autre"))


class ExtractionTests(unittest.TestCase):
    TEXT = "Le preavis de resiliation est de quatre-vingt-dix jours."

    def test_pdf_pages_keep_their_numbers(self) -> None:
        pages = extract_pages(make_pdf([self.TEXT, "Deuxieme page sur la confidentialite."]), "pdf")
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0].label, "Page 1")
        self.assertEqual(pages[1].label, "Page 2")
        self.assertIn("preavis", pages[0].text)

    def test_docx_is_read(self) -> None:
        pages = extract_pages(make_docx(["Contrat Atlas", self.TEXT]), "docx")
        self.assertEqual(len(pages), 1)
        self.assertIn("Atlas", pages[0].text)

    def test_csv_is_read(self) -> None:
        pages = extract_pages(make_csv([["fournisseur", "delai"], ["Atlas", "30 jours"]]), "csv")
        self.assertIn("Atlas", pages[0].text)
        self.assertIn("|", pages[0].text)

    def test_xlsx_is_read_per_sheet(self) -> None:
        pages = extract_pages(make_xlsx([["Atlas", "94"], ["Beta", "12"]]), "xlsx")
        self.assertEqual(pages[0].label, "Feuille Fournisseurs")
        self.assertIn("Atlas", pages[0].text)

    def test_corrupted_docx_raises_extraction_error(self) -> None:
        with self.assertRaises(ExtractionFailed):
            extract_pages(b"PK\x03\x04" + b"\x00" * 64, "docx")

    def test_pdf_without_text_is_empty_document(self) -> None:
        with self.assertRaises(EmptyDocument):
            extract_pages(make_pdf([""]), "pdf")

    def test_unsupported_reader_raises(self) -> None:
        with self.assertRaises(UnsupportedFormat):
            extract_pages(b"abc", "txt")

    def test_clean_text_collapses_spaces(self) -> None:
        self.assertEqual(clean_text("a   b\n\n\n\nc"), "a b\n\nc")


class ChunkingTests(unittest.TestCase):
    def test_chunks_keep_page_labels_and_ordinals(self) -> None:
        pages = extract_pages(
            make_pdf(["Le contrat prevoit un preavis de 90 jours. " * 20, "La confidentialite est obligatoire."]),
            "pdf",
        )
        chunks = chunk_pages(pages, chunk_size=200, chunk_overlap=20)
        self.assertGreaterEqual(len(chunks), 3)
        self.assertEqual([chunk.ordinal for chunk in chunks], list(range(len(chunks))))
        self.assertEqual(chunks[0].label, "Page 1")
        self.assertEqual(chunks[-1].label, "Page 2")
        self.assertTrue(all(len(chunk.text) <= 260 for chunk in chunks))

    def test_empty_pages_raise(self) -> None:
        with self.assertRaises(EmptyDocument):
            chunk_pages([], chunk_size=500, chunk_overlap=50)


if __name__ == "__main__":
    unittest.main()
