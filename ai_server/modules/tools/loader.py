
import importlib.util
import inspect
import re
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from modules.tools.core.contracts import BaseToolProvider, ToolExecutionContext
from modules.tools.validator import ToolManifestValidator


class ToolProviderLoadError(Exception):
    pass


class LoadedToolProvider:
    def __init__(
        self,
        key: str,
        directory: Path,
        manifest_path: Path,
        implementation_path: Path,
        manifest: dict[str, Any],
        provider_class: type[BaseToolProvider],
        module: ModuleType,
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
        context: ToolExecutionContext | None = None,
    ) -> BaseToolProvider:
        return self.provider_class(
            manifest=self.manifest,
            context=context,
        )


class ToolProviderLoader:
    def __init__(
        self,
        providers_directory: Path | None = None,
        validator: ToolManifestValidator | None = None,
    ):
        self.providers_directory = providers_directory or (
            Path(__file__).parent / "providers"
        )
        self.validator = validator or ToolManifestValidator()

    def discover_directories(self) -> list[Path]:
        if not self.providers_directory.is_dir():
            raise ToolProviderLoadError(
                f"Providers directory not found: {self.providers_directory}"
            )

        return sorted(
            directory
            for directory in self.providers_directory.iterdir()
            if directory.is_dir()
            and not directory.name.startswith((".", "_"))
            and directory.name != "schemas"
        )

    def load_all(self) -> dict[str, LoadedToolProvider]:
        loaded: dict[str, LoadedToolProvider] = {}
        errors: list[str] = []

        for directory in self.discover_directories():
            try:
                provider = self.load(directory)
                if provider.key in loaded:
                    raise ToolProviderLoadError(
                        f"Duplicate provider key: {provider.key}"
                    )
                loaded[provider.key] = provider
            except Exception as exc:
                errors.append(f"{directory.name}: {exc}")

        if errors:
            raise ToolProviderLoadError(
                "Tool provider loading failed:\n" + "\n".join(errors)
            )

        return loaded

    def load(self, directory: Path) -> LoadedToolProvider:
        manifest_files = list(directory.glob("*.json"))

        if len(manifest_files) != 1:
            raise ToolProviderLoadError(
                f"{directory.name} must contain exactly one JSON manifest"
            )

        manifest_path = manifest_files[0]
        manifest = self.validator.load_manifest(manifest_path)
        provider_data = manifest["provider"]

        if provider_data["slug"] != directory.name:
            raise ToolProviderLoadError(
                f"Manifest slug '{provider_data['slug']}' "
                f"does not match directory '{directory.name}'"
            )

        implementation = manifest["implementation"]
        module_name = implementation["module"]
        class_name = implementation["class"]

        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", module_name):
            raise ToolProviderLoadError(
                f"Invalid implementation module '{module_name}'"
            )

        implementation_path = directory / f"{module_name}.py"

        if not implementation_path.is_file():
            raise ToolProviderLoadError(
                f"Missing implementation file: {implementation_path.name}"
            )

        module = self._import_module(
            implementation_path,
            provider_data["key"],
        )

        provider_class = getattr(module, class_name, None)

        if provider_class is None or not inspect.isclass(provider_class):
            raise ToolProviderLoadError(
                f"Implementation class '{class_name}' not found"
            )

        if not issubclass(provider_class, BaseToolProvider):
            raise ToolProviderLoadError(
                f"'{class_name}' must extend BaseToolProvider"
            )

        if inspect.isabstract(provider_class):
            raise ToolProviderLoadError(
                f"'{class_name}' has unimplemented abstract methods"
            )

        return LoadedToolProvider(
            key=provider_data["key"],
            directory=directory,
            manifest_path=manifest_path,
            implementation_path=implementation_path,
            manifest=manifest,
            provider_class=provider_class,
            module=module,
        )

    @staticmethod
    def _import_module(
        implementation_path: Path,
        provider_key: str,
    ) -> ModuleType:
        safe_key = re.sub(
            r"[^A-Z0-9_]",
            "_",
            provider_key.upper(),
        )
        module_name = f"aiverse_tool_provider_{safe_key}"

        spec = importlib.util.spec_from_file_location(
            module_name,
            implementation_path,
        )

        if spec is None or spec.loader is None:
            raise ToolProviderLoadError(
                f"Unable to import {implementation_path}"
            )

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module

        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(module_name, None)
            raise

        return module
