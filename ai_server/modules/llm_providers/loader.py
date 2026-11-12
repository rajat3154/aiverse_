
import importlib.util
import inspect
import re
from pathlib import Path
from types import ModuleType
from typing import Any
from modules.llm_providers.base import BaseLLMProvider
from modules.llm_providers.validator import ManifestValidator
class ProviderLoadError(Exception):
    pass
class LoadedProvider:
    def __init__(
        self,
        key: str,
        directory: Path,
        manifest_path: Path,
        implementation_path: Path,
        manifest: dict[str, Any],
        provider_class: type[BaseLLMProvider],
        module: ModuleType
    ):
        self.key = key
        self.directory = directory
        self.manifest_path = manifest_path
        self.implementation_path = implementation_path
        self.manifest = manifest
        self.provider_class = provider_class
        self.module = module
    def create(
        self,
        context: Any
    ) -> BaseLLMProvider:
        return self.provider_class(
            context=context,
            manifest=self.manifest
        )
class ProviderLoader:
    def __init__(
        self,
        providers_directory: Path | None = None,
        validator: ManifestValidator | None = None
    ):
        self.providers_directory = providers_directory or Path(__file__).parent
        self.validator = validator or ManifestValidator()
    def discover_directories(self) -> list[Path]:
        if not self.providers_directory.is_dir():
            raise ProviderLoadError(
                f"Providers directory not found: {self.providers_directory}"
            )
        return sorted(
            directory
            for directory in self.providers_directory.iterdir()
            if directory.is_dir() and not directory.name.startswith((".", "_"))
            and directory.name != "schemas"
        )
    def load_all(self) -> dict[str, LoadedProvider]:
        loaded: dict[str, LoadedProvider] = {}
        errors: list[str] = []
        for directory in self.discover_directories():
            try:
                provider = self.load(directory)
                if provider.key in loaded:
                    raise ProviderLoadError(
                        f"Duplicate provider key: {provider.key}"
                    )
                loaded[provider.key] = provider
            except Exception as exc:
                errors.append(f"{directory.name}: {exc}")
        if errors:
            raise ProviderLoadError(
                "Provider loading failed:\n" + "\n".join(errors)
            )
        return loaded
    def load(self, directory: Path) -> LoadedProvider:
        manifest_files = list(directory.glob("*.json"))
        if len(manifest_files) != 1:
            raise ProviderLoadError(
                "Provider directory must contain exactly one JSON manifest"
            )
        manifest_path = manifest_files[0]
        manifest = self.validator.load_manifest(manifest_path)
        provider_data = manifest["provider"]
        expected_slug = directory.name
        if provider_data["slug"] != expected_slug:
            raise ProviderLoadError(
                f"Manifest slug '{provider_data['slug']}' "
                f"does not match directory '{expected_slug}'"
            )
        provider_class_name = manifest["implementation"]["class"]
        # the implementation file is named by the manifest ("module": "openai" -> openai.py); default provider.py
        module_name = manifest["implementation"].get("module") or "provider"
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", module_name):
            raise ProviderLoadError(f"Invalid implementation module '{module_name}'")
        provider_file = directory / f"{module_name}.py"
        if not provider_file.is_file():
            raise ProviderLoadError(f"Missing {module_name}.py")
        module = self._import_module(
            provider_file,
            provider_data["key"]
        )
        provider_class = getattr(module, provider_class_name, None)
        if provider_class is None:
            raise ProviderLoadError(
                f"Implementation class '{provider_class_name}' not found"
            )
        if not inspect.isclass(provider_class):
            raise ProviderLoadError(
                f"'{provider_class_name}' is not a class"
            )
        if not issubclass(provider_class, BaseLLMProvider):
            raise ProviderLoadError(
                f"'{provider_class_name}' must extend BaseLLMProvider"
            )
        if inspect.isabstract(provider_class):
            raise ProviderLoadError(
                f"'{provider_class_name}' has unimplemented abstract methods"
            )
        return LoadedProvider(
            key=provider_data["key"],
            directory=directory,
            manifest_path=manifest_path,
            implementation_path=provider_file,
            manifest=manifest,
            provider_class=provider_class,
            module=module
        )
    @staticmethod
    def _import_module(
        provider_file: Path,
        provider_key: str
    ) -> ModuleType:
        safe_key = re.sub(r"[^A-Z0-9_]", "_", provider_key.upper())
        module_name = f"aiverse_llm_provider_{safe_key}"
        spec = importlib.util.spec_from_file_location(
            module_name,
            provider_file
        )
        if spec is None or spec.loader is None:
            raise ProviderLoadError(
                f"Unable to create import specification for {provider_file}"
            )
        module = importlib.util.module_from_spec(spec)
        import sys
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(module_name, None)
            raise
        return module
