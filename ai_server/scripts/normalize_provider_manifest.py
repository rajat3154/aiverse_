import json
import shutil
import sys
from pathlib import Path

PROVIDER_KEYS = ("key", "name", "slug", "description", "category", "status", "version", "logo", "website", "tags")
METADATA_KEYS = ("publisher", "regions", "pricing_url", "support_url", "release_notes_url")
DOC_KEYS = ("official", "api_reference", "models", "pricing")
UI_KEYS = ("icon", "color", "featured", "show_in_catalog", "display_name", "configuration_layout", "parameter_layout", "default_collapsed_groups", "badges")


def flatten(section: dict, advanced: set[str] | None = None) -> dict:
    groups, fields = [], []
    for g_index, group in enumerate(section.get("groups", []), start=1):
        nested = group.get("fields", [])
        groups.append({**{k: v for k, v in group.items() if k != "fields"}, "order": g_index})
        for f_index, field in enumerate(nested, start=1):
            out = {k: v for k, v in field.items() if k not in ("min", "max", "description")}
            out["group"] = group["key"]
            out["order"] = f_index
            out["supported"] = True
            if field.get("description") and "help_text" not in field:
                out["help_text"] = field["description"]
            if "min" in field:
                out["minimum"] = field["min"]
            if "max" in field:
                out["maximum"] = field["max"]
            if advanced and field["key"] in advanced:
                out["advanced"] = True
            fields.append(out)
    return {"groups": groups, "fields": fields or section.get("fields", [])}


def normalize(old: dict, directory: Path) -> dict:
    provider = {k: old["provider"][k] for k in PROVIDER_KEYS if k in old["provider"]}
    provider["slug"] = old["provider"]["key"].lower().replace("_", "-")
    provider.setdefault("status", "active")
    provider.setdefault("version", "1.0.0")
    provider.setdefault("logo", None)
    provider.setdefault("website", old["provider"].get("website") or old["provider"].get("documentation_url"))
    provider.setdefault("tags", [t.lower().replace(" ", "_") for t in old.get("ui", {}).get("tags", [])] or ["llm", "chat"])

    impl = old.get("implementation", {})
    files = [f.stem for f in directory.glob("*.py")]
    declared = impl.get("module")
    module = declared if declared in files else (files[0] if len(files) == 1 else declared or provider["slug"].replace("-", "_"))
    implementation = {"module": module, "class": impl["class"], "version": impl.get("version", "1.0.0"), "interface_version": impl.get("interface_version", "1.0.0")}

    old_meta = old.get("metadata", {})
    metadata = {k: old_meta[k] for k in METADATA_KEYS if k in old_meta}
    metadata.setdefault("publisher", old["provider"]["name"])
    metadata.setdefault("regions", [])
    metadata["custom"] = {k: v for k, v in old_meta.items() if k not in METADATA_KEYS}

    cred = old.get("credentials", {})
    primary = cred.get("primary_type", "api_key")
    credentials = {
        "required": cred.get("required", True),
        "supported_types": cred.get("supported_types", [primary]),
        "primary_type": primary,
        "allow_multiple": cred.get("allow_multiple", False),
        "credential_schema": [
            {
                "key": c["key"],
                "label": c.get("label", c["key"]),
                "type": "secret",
                "credential_type": c.get("credential_type", primary),
                "required": c.get("required", True),
                "description": c.get("description", ""),
            }
            for c in cred.get("credential_schema", cred.get("fields", []))
        ],
    }

    configuration = flatten(old.get("configuration", {"groups": []}))
    for field in configuration["fields"]:
        if field["key"] == "base_url":
            if field.get("default"):
                field["placeholder"] = field.pop("default")
                field["default"] = None
            field["advanced"] = True
    for group in configuration["groups"]:
        group.setdefault("description", f"{group.get('label', group['key'])} for this provider.")

    parameters = flatten(old.get("parameters", {"groups": []}))
    for group in parameters["groups"]:
        group.setdefault("description", f"{group.get('label', group['key'])}.")

    discovery = old.get("model_discovery", {})
    remote = dict(discovery.get("remote", {}))
    if "endpoint" in remote:
        remote["path"] = remote.pop("endpoint")
    if remote:
        remote.setdefault("operation", "discover_models")
    model_discovery = {
        "strategy": discovery.get("strategy", "hybrid"),
        "auto_discover": True,
        "cache": {"enabled": True, "ttl_seconds": discovery.get("cache", {}).get("ttl_seconds", 3600)},
        "fallback": discovery.get("fallback", {"enabled": True, "models": []}),
    }

    if remote:
        model_discovery["remote"] = remote

    ui_old = old.get("ui", {})
    ui = {k: ui_old[k] for k in UI_KEYS if k in ui_old}
    ui.setdefault("show_in_catalog", True)
    ui.setdefault("display_name", old["provider"]["name"])
    ui.setdefault("configuration_layout", "grouped")
    ui.setdefault("parameter_layout", "grouped")
    ui.setdefault("default_collapsed_groups", [g["key"] for g in parameters["groups"][-1:]])
    ui.setdefault("badges", ui_old.get("tags", [])[:2])

    docs_old = old.get("documentation", {})
    documentation = {k: docs_old[k] for k in DOC_KEYS if k in docs_old}
    documentation.setdefault("official", docs_old.get("documentation") or old["provider"].get("documentation_url") or ui_old.get("documentation_url") or provider.get("website"))

    compat_old = old.get("compatibility", {})
    packages = compat_old.get("packages", {})
    if isinstance(packages, list): 
        first = packages[0] if packages else impl.get("package", "")
        packages = {first: impl.get("min_version", "")} if isinstance(first, str) else {first.get("name", ""): first.get("version", "")}
    sdk_name, sdk_min = next(iter(packages.items()), (impl.get("package", ""), impl.get("min_version", "")))
    compatibility = {
        "python": compat_old.get("python", ">=3.14"),
        "ai_server_interface": "1.0.0",
        "sdk": {"package": sdk_name, "minimum_version": str(sdk_min).lstrip(">="), "maximum_version": None},
    }

    return {
        "schema_version": old.get("schema_version", "1.0.0"),
        "provider": provider,
        "implementation": implementation,
        "metadata": metadata,
        "capabilities": old.get("capabilities", {}),
        "credentials": credentials,
        "configuration": configuration,
        "model_discovery": model_discovery,
        "model_schema": {
            "required_fields": ["id", "name"],
            "fields": {
                "id": "string", "name": "string", "description": "string", "capabilities": "object", "context_window": "integer",
                "max_output_tokens": "integer", "input_modalities": "array", "output_modalities": "array", "metadata": "object",
            },
        },
        "parameters": parameters,
        "operations": old.get("operations", {}),
        "ui": ui,
        "documentation": documentation,
        "compatibility": compatibility,
    }


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    path = Path(sys.argv[1])
    old = json.loads(path.read_text(encoding="utf-8"))
    shutil.copyfile(path, path.with_suffix(".json.bak"))
    result = normalize(old, path.parent)
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Rewrote {path} (backup: {path.with_suffix('.json.bak').name})")
    if path.parent.name != result["provider"]["slug"]:
        print(f"NOTE: rename the directory '{path.parent.name}' to '{result['provider']['slug']}' (the loader requires it to match the slug).")


if __name__ == "__main__":
    main()
