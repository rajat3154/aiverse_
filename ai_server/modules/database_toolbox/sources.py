"""The MCP Toolbox database catalog: which databases can be connected and which fields each one needs.

What people see (name, category, description, logo) is written here, because upstream has no usable text for it. The
connection fields are not: they are read from the official MCP Toolbox documentation (see ``discovery.py``) and kept
in ``upstream_snapshot.json`` so the catalog still works when GitHub cannot be reached. The tool provider refreshes
them from upstream each time the catalog syncs.
"""
import json
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SNAPSHOT_PATH = Path(__file__).with_name("upstream_snapshot.json")

_SI = "https://cdn.simpleicons.org/"
_GENERIC_DB = "https://api.iconify.design/mdi/database.svg?color=%239AA7B6"
_MSSQL = "https://api.iconify.design/simple-icons/microsoftsqlserver.svg?color=%23CC2927"


@dataclass(frozen=True)
class Field:
    name: str
    type: str = "string"  # string | integer | secret
    required: bool = False
    default: Any = None

    def to_json_schema(self) -> dict[str, Any]:
        schema: dict[str, Any] = {"type": "integer" if self.type == "integer" else "string"}
        if self.type == "secret":
            schema.update({"format": "password", "writeOnly": True})
        if self.default is not None:
            schema["default"] = self.default
        return schema

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Field":
        return cls(name=data["name"], type=data.get("type", "string"), required=bool(data.get("required")), default=data.get("default"))


@dataclass(frozen=True)
class Presentation:
    slug: str
    name: str
    category: str
    description: str
    logo: str


@dataclass(frozen=True)
class Source:
    slug: str
    name: str
    category: str
    description: str
    logo: str
    documentation_url: str
    fields: tuple[Field, ...] = field(default_factory=tuple)
    fields_documented: bool = False  # True when the fields come from the upstream documentation

    @property
    def secret_fields(self) -> frozenset[str]:
        return frozenset(f.name for f in self.fields if f.type == "secret")

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {f.name: f.to_json_schema() for f in self.fields},
            "required": [f.name for f in self.fields if f.required],
        }

    def metadata(self) -> dict[str, Any]:
        port = next((f.default for f in self.fields if f.name == "port"), None)
        return {
            "kind": "database",
            "source_type": self.slug,
            "logo": self.logo,
            "documentation_url": self.documentation_url,
            "default_port": port,
            "requires_secret": bool(self.secret_fields),
            "configuration_schema_verified": self.fields_documented,
        }


PRESENTATION: tuple[Presentation, ...] = (
    Presentation('alloydb-postgres', 'AlloyDB for PostgreSQL', 'relational',
                 "Google's PostgreSQL-compatible managed database, built for demanding transactional and analytical workloads.",
                 'https://cdn.simpleicons.org/postgresql'),
    Presentation('arcadedb', 'ArcadeDB', 'graph',
                 'Multi-model database that handles graph, document, key-value and time-series data in one engine.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('bigquery', 'BigQuery', 'warehouse',
                 "Google's serverless data warehouse for running fast SQL analytics over very large datasets.",
                 'https://cdn.simpleicons.org/googlebigquery'),
    Presentation('bigtable', 'Bigtable', 'wide-column',
                 "Google's wide-column NoSQL database for high-throughput, low-latency workloads at massive scale.",
                 'https://cdn.simpleicons.org/googlebigtable'),
    Presentation('cassandra', 'Cassandra', 'wide-column',
                 'Distributed wide-column NoSQL database designed for high availability and linear scalability.',
                 'https://cdn.simpleicons.org/apachecassandra'),
    Presentation('clickhouse', 'ClickHouse', 'warehouse',
                 'Column-oriented database built for real-time analytics over billions of rows.',
                 'https://cdn.simpleicons.org/clickhouse'),
    Presentation('cloud-sql-mssql', 'Cloud SQL for SQL Server', 'relational',
                 'Managed Microsoft SQL Server on Google Cloud, with automated backups and patching.',
                 'https://api.iconify.design/simple-icons/microsoftsqlserver.svg?color=%23CC2927'),
    Presentation('cloud-sql-mysql', 'Cloud SQL for MySQL', 'relational',
                 'Managed MySQL on Google Cloud, with automated backups, replication and patching.',
                 'https://cdn.simpleicons.org/mysql'),
    Presentation('cloud-sql-postgres', 'Cloud SQL for PostgreSQL', 'relational',
                 'Managed PostgreSQL on Google Cloud, with automated backups, replication and patching.',
                 'https://cdn.simpleicons.org/postgresql'),
    Presentation('cockroachdb', 'CockroachDB', 'relational',
                 'Distributed SQL database that stays consistent and survives node, zone and region failures.',
                 'https://cdn.simpleicons.org/cockroachlabs'),
    Presentation('couchbase', 'Couchbase', 'document',
                 'Distributed NoSQL document database with built-in caching, SQL-like queries and full-text search.',
                 'https://cdn.simpleicons.org/couchbase'),
    Presentation('dgraph', 'Dgraph', 'graph',
                 'Distributed graph database queried with GraphQL and DQL, built for highly connected data.',
                 'https://cdn.simpleicons.org/dgraph'),
    Presentation('duckdb', 'DuckDB', 'warehouse',
                 'In-process analytical SQL database that queries local files such as Parquet and CSV directly.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('elasticsearch', 'Elasticsearch', 'search',
                 'Search and analytics engine for full-text search, log analysis and vector search.',
                 'https://cdn.simpleicons.org/elasticsearch'),
    Presentation('falkordb', 'FalkorDB', 'graph',
                 'Low-latency graph database queried with Cypher, aimed at GraphRAG and knowledge graphs.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('firebird', 'Firebird', 'relational',
                 'Open-source relational database with a long history and a small footprint.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('firestore', 'Firestore', 'document',
                 "Google's serverless document database with flexible schemas and real-time synchronization.",
                 'https://cdn.simpleicons.org/googlecloud'),
    Presentation('mindsdb', 'MindsDB', 'relational',
                 'Query layer that lets you ask SQL questions of many data sources and run AI models alongside them.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('mongodb', 'MongoDB', 'document',
                 'Document database that stores flexible JSON-like documents, with rich queries and aggregation.',
                 'https://cdn.simpleicons.org/mongodb'),
    Presentation('mssql', 'SQL Server', 'relational',
                 "Microsoft's relational database, queried with T-SQL and widely used in enterprise applications.",
                 'https://api.iconify.design/simple-icons/microsoftsqlserver.svg?color=%23CC2927'),
    Presentation('mysql', 'MySQL / MariaDB', 'relational',
                 'Popular open-source relational database; this source also covers MySQL-compatible servers such as MariaDB.',
                 'https://cdn.simpleicons.org/mysql'),
    Presentation('neo4j', 'Neo4j', 'graph',
                 'Graph database queried with Cypher, suited to relationships, recommendations and knowledge graphs.',
                 'https://cdn.simpleicons.org/neo4j'),
    Presentation('oceanbase', 'OceanBase', 'relational',
                 'Distributed relational database that supports both MySQL and Oracle compatibility modes.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('oracle', 'Oracle Database', 'relational',
                 'Enterprise relational database with strong transaction, security and PL/SQL support.',
                 'https://cdn.simpleicons.org/oracle'),
    Presentation('postgres', 'PostgreSQL', 'relational',
                 'Advanced open-source relational database known for standards compliance and extensibility.',
                 'https://cdn.simpleicons.org/postgresql'),
    Presentation('redis', 'Redis', 'key-value',
                 'In-memory data store used for caching, queues, sessions and real-time data structures.',
                 'https://cdn.simpleicons.org/redis'),
    Presentation('scylladb', 'ScyllaDB', 'wide-column',
                 'High-performance Cassandra-compatible NoSQL database built for low, predictable latency.',
                 'https://cdn.simpleicons.org/scylladb'),
    Presentation('singlestore', 'SingleStore', 'relational',
                 'Distributed SQL database that combines transactions and real-time analytics in one system.',
                 'https://cdn.simpleicons.org/singlestore'),
    Presentation('snowflake', 'Snowflake', 'warehouse',
                 'Cloud data warehouse that separates storage from compute for scalable SQL analytics.',
                 'https://cdn.simpleicons.org/snowflake'),
    Presentation('spanner', 'Spanner', 'relational',
                 "Google's globally distributed relational database with strong consistency and horizontal scale.",
                 'https://cdn.simpleicons.org/googlecloudspanner'),
    Presentation('sqlite', 'SQLite', 'relational',
                 'Self-contained, serverless SQL database stored in a single local file.',
                 'https://cdn.simpleicons.org/sqlite'),
    Presentation('tidb', 'TiDB', 'relational',
                 'Distributed MySQL-compatible database that supports both transactional and analytical workloads.',
                 'https://cdn.simpleicons.org/tidb'),
    Presentation('trino', 'Trino', 'warehouse',
                 'Distributed SQL query engine that runs fast queries across many data sources at once.',
                 'https://cdn.simpleicons.org/trino'),
    Presentation('valkey', 'Valkey', 'key-value',
                 'Open-source, Redis-compatible in-memory data store for caching and real-time workloads.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
    Presentation('yugabytedb', 'YugabyteDB', 'relational',
                 'Distributed PostgreSQL-compatible database built for resilience and horizontal scaling.',
                 'https://api.iconify.design/mdi/database.svg?color=%239AA7B6'),
)

# Sources the upstream documentation does not describe (or describes differently) get their fields here.
EXTRA_FIELDS: dict[str, tuple[Field, ...]] = {
    "duckdb": (Field("path", required=True),),
}

DOC_URL = "https://mcp-toolbox.dev/documentation/integrations/{slug}/source/"


class _Catalog:
    """Fields per source: the bundled snapshot at start-up, replaced by a fresh upstream read when one succeeds."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.commit: str | None = None
        self.upstream: dict[str, dict[str, Any]] = {}
        self._load_snapshot()

    def _load_snapshot(self) -> None:
        try:
            data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        self.replace(data.get("commit"), data.get("sources") or {})

    def replace(self, commit: str | None, upstream: dict[str, dict[str, Any]]) -> None:
        with self._lock:
            self.commit = commit
            self.upstream = dict(upstream)

    def sources(self) -> tuple[Source, ...]:
        with self._lock:
            upstream = self.upstream
            built = []
            for p in PRESENTATION:
                info = upstream.get(p.slug) or {}
                documented = bool(info.get("fields"))
                fields = tuple(Field.from_dict(f) for f in info.get("fields", [])) or EXTRA_FIELDS.get(p.slug, ())
                built.append(Source(p.slug, p.name, p.category, p.description, p.logo,
                                    info.get("documentation_url") or DOC_URL.format(slug=p.slug), fields, documented))
            return tuple(built)


_catalog = _Catalog()


def all_sources() -> tuple[Source, ...]:
    return _catalog.sources()


def upstream_commit() -> str | None:
    return _catalog.commit


def set_upstream(commit: str | None, upstream: dict[str, dict[str, Any]]) -> None:
    _catalog.replace(commit, upstream)


def get_source(slug: str) -> Source | None:
    wanted = (slug or "").strip().lower()
    return next((s for s in _catalog.sources() if s.slug == wanted), None)
