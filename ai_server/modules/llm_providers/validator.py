
import json
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError, ValidationError
class ManifestValidationError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))
class ManifestValidator:
    def __init__(self, schema_path: Path | None = None):
        self.schema_path = schema_path or (
            Path(__file__).parent / "schemas" / "manifest.schema.json"
        )
        self.schema = self._load_schema()
        Draft202012Validator.check_schema(self.schema)
        self.validator = Draft202012Validator(
            self.schema,
            format_checker=FormatChecker()
        )
    def _load_schema(self) -> dict[str, Any]:
        if not self.schema_path.is_file():
            raise FileNotFoundError(
                f"Manifest schema not found: {self.schema_path}"
            )
        try:
            with self.schema_path.open("r", encoding="utf-8") as file:
                schema = json.load(file)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Invalid manifest schema JSON: {exc}"
            ) from exc
        if not isinstance(schema, dict):
            raise ValueError("Manifest schema must be a JSON object")
        return schema
    def load_manifest(self, manifest_path: Path) -> dict[str, Any]:
        if not manifest_path.is_file():
            raise FileNotFoundError(
                f"Manifest file not found: {manifest_path}"
            )
        try:
            with manifest_path.open("r", encoding="utf-8") as file:
                manifest = json.load(file)
        except json.JSONDecodeError as exc:
            raise ManifestValidationError([
                f"Invalid JSON in {manifest_path.name}: {exc}"
            ]) from exc
        return self.validate(manifest, source=manifest_path.name)
    def validate(
        self,
        manifest: dict[str, Any],
        source: str = "manifest"
    ) -> dict[str, Any]:
        if not isinstance(manifest, dict):
            raise ManifestValidationError([
                f"{source}: manifest root must be a JSON object"
            ])
        errors = [
            self._format_error(error)
            for error in sorted(
                self.validator.iter_errors(manifest),
                key=lambda item: list(map(str, item.absolute_path))
            )
        ]
        errors.extend(self._validate_cross_fields(manifest))
        if errors:
            raise ManifestValidationError([
                f"{source}: {error}" for error in errors
            ])
        return manifest
    @staticmethod
    def _format_error(error: ValidationError) -> str:
        path = ".".join(str(part) for part in error.absolute_path)
        location = path or "root"
        return f"{location}: {error.message}"
    @staticmethod
    def _validate_cross_fields(
        manifest: dict[str, Any]
    ) -> list[str]:
        errors: list[str] = []
        provider = manifest.get("provider", {})
        credentials = manifest.get("credentials", {})
        discovery = manifest.get("model_discovery", {})
        configuration = manifest.get("configuration", {})
        parameters = manifest.get("parameters", {})
        operations = manifest.get("operations", {})
        provider_key = provider.get("key")
        slug = provider.get("slug")
        if provider_key and slug:
            if provider_key.lower().replace("_", "-") != slug:
                errors.append(
                    "provider.key and provider.slug do not match"
                )
        credential_types = credentials.get("supported_types", [])
        primary_type = credentials.get("primary_type")
        if primary_type and primary_type not in credential_types:
            errors.append(
                "credentials.primary_type must be in supported_types"
            )
        if credentials.get("required") and not credentials.get(
            "credential_schema"
        ):
            errors.append(
                "Required credentials need at least one credential_schema field"
            )
        for section_name, section in [
            ("configuration", configuration),
            ("parameters", parameters)
        ]:
            groups = section.get("groups", [])
            fields = section.get("fields", [])
            group_keys = [group.get("key") for group in groups]
            if len(group_keys) != len(set(group_keys)):
                errors.append(
                    f"{section_name}.groups contains duplicate keys"
                )
            field_keys = [item.get("key") for item in fields]
            if len(field_keys) != len(set(field_keys)):
                errors.append(
                    f"{section_name}.fields contains duplicate keys"
                )
            known_groups = set(group_keys)
            for item in fields:
                group = item.get("group")
                if group and group not in known_groups:
                    errors.append(
                        f"{section_name}.fields.{item.get('key')} "
                        f"references unknown group '{group}'"
                    )
        strategy = discovery.get("strategy")
        fallback = discovery.get("fallback", {})
        if strategy == "manifest" and discovery.get("remote"):
            errors.append(
                "Manifest-only discovery must not define remote discovery"
            )
        if strategy in ("remote", "hybrid") and not discovery.get("remote"):
            errors.append(
                f"{strategy} discovery requires remote configuration"
            )
        if strategy == "remote" and fallback.get("enabled"):
            errors.append(
                "Remote-only discovery cannot enable fallback models"
            )
        if strategy == "manifest" and not fallback.get("enabled"):
            errors.append(
                "Manifest-only discovery requires enabled fallback models"
            )
        if strategy == "hybrid" and not fallback.get("enabled"):
            errors.append(
                "Hybrid discovery requires enabled fallback models"
            )
        for operation_name, operation in operations.items():
            if not operation.get("enabled"):
                continue
            handler = operation.get("handler")
            if not handler:
                errors.append(
                    f"operations.{operation_name} has no handler"
                )
        return errors
