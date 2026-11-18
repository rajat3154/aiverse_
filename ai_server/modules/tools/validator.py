
import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError


class ToolManifestValidationError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


class ToolManifestValidator:
    def __init__(self, schema_path: Path | None = None):
        self.schema_path = schema_path or (Path(__file__).parent / "schemas" / "manifest.schema.json")
        self.schema = self._load_schema()
        Draft202012Validator.check_schema(self.schema)
        self.validator = Draft202012Validator(self.schema,format_checker=FormatChecker())

    def _load_schema(self) -> dict[str, Any]:
        if not self.schema_path.is_file():
            raise FileNotFoundError(f"Tool manifest schema not found: {self.schema_path}")
        try:
            with self.schema_path.open("r", encoding="utf-8") as file:
                schema = json.load(file)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid tool manifest schema JSON: {exc}") from exc
        if not isinstance(schema, dict):
            raise ValueError("Tool manifest schema must be a JSON object")
        return schema

    def load_manifest(self, manifest_path: Path) -> dict[str, Any]:
        if not manifest_path.is_file():
            raise FileNotFoundError(f"Tool manifest not found: {manifest_path}")
        try:
            with manifest_path.open("r", encoding="utf-8") as file:
                manifest = json.load(file)
        except json.JSONDecodeError as exc:
            raise ToolManifestValidationError([f"Invalid JSON in {manifest_path.name}: {exc}"]) from exc
        return self.validate(manifest, source=manifest_path.name)

    def validate(self,manifest: dict[str, Any],source: str = "manifest") -> dict[str, Any]:
        if not isinstance(manifest, dict):
            raise ToolManifestValidationError([f"{source}: manifest root must be a JSON object"])

        errors = [self._format_error(error) for error in sorted(self.validator.iter_errors(manifest), key=lambda item: list(map(str, item.absolute_path)))]

        provider = manifest.get("provider", {})
        implementation = manifest.get("implementation", {})

        if provider and implementation:
            if provider.get("key") and provider.get("slug"):
                expected_slug = provider["key"].replace("_", "-")
                if expected_slug != provider["slug"]:
                    errors.append(
                        "provider.slug must match provider.key with underscores replaced by hyphens"
                    )

        if errors:
            raise ToolManifestValidationError([
                f"{source}: {error}" for error in errors
            ])

        return manifest

    @staticmethod
    def _format_error(error: ValidationError) -> str:
        path = ".".join(str(part) for part in error.absolute_path)
        return f"{path or 'root'}: {error.message}"
