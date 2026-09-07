from pathlib import Path

import pytest

from config.config import TinybirdConfig, build_tinybird_config


def test_tinybird_config_is_disabled_when_values_are_absent():
    assert build_tinybird_config(None, None, None) is None


@pytest.mark.parametrize(
    "missing_index",
    [0, 1, 2],
)
def test_tinybird_config_requires_all_three_values(missing_index):
    values = [
        "https://api.example.tinybird.co/",
        "ingest-token",
        "read-token",
    ]
    values[missing_index] = ""

    assert build_tinybird_config(*values) is None


def test_tinybird_config_rejects_whitespace_only_values():
    assert build_tinybird_config("https://api.example.tinybird.co", "  ", "read") is None
    assert build_tinybird_config("https://api.example.tinybird.co", "ingest", "\t") is None


def test_tinybird_config_normalises_url_and_preserves_ready_tokens():
    config = build_tinybird_config(
        "  https://api.example.tinybird.co/// ",
        " ingest-token ",
        " read-token ",
    )

    assert isinstance(config, TinybirdConfig)
    assert config.api_url == "https://api.example.tinybird.co"
    assert config.ingest_token == "ingest-token"
    assert config.read_token == "read-token"


def test_tinybird_config_ignores_non_string_values():
    assert build_tinybird_config(123, "ingest", "read") is None


def test_events_datasource_declares_separate_forward_resource_tokens():
    datasource = (
        Path(__file__).resolve().parents[3]
        / "src/db/tinybird/datasources/events.datasource"
    )
    first_lines = datasource.read_text(encoding="utf-8").splitlines()[:2]

    assert first_lines == [
        "TOKEN learnhouse_events_ingest APPEND",
        "TOKEN learnhouse_events_read READ",
    ]
