"""Command line interface for tealtiger-redteam."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from tealtiger_redteam.reporting import render_json, render_terminal
from tealtiger_redteam.scanner import scan_file


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and return a process exit code."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "scan":
        return _scan(args.path, json_output=args.json, output=args.output)

    parser.print_help(sys.stderr)
    return 2


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tealtiger-redteam",
        description="Static red-team scanner for Haystack pipeline Python files.",
    )
    subparsers = parser.add_subparsers(dest="command")
    scan_parser = subparsers.add_parser("scan", help="scan a Haystack pipeline Python file")
    scan_parser.add_argument("path", help="path to a Haystack pipeline Python file")
    scan_parser.add_argument(
        "--json", action="store_true", help="print JSON instead of terminal text"
    )
    scan_parser.add_argument("--output", help="write JSON report to this path")
    return parser


def _scan(path_value: str, *, json_output: bool, output: str | None) -> int:
    path = Path(path_value)
    if not path.exists():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 2
    if not path.is_file():
        print(f"error: not a file: {path}", file=sys.stderr)
        return 2

    try:
        report = scan_file(path)
    except SyntaxError as exc:
        print(f"error: could not parse {path}: {exc}", file=sys.stderr)
        return 2

    if output:
        Path(output).write_text(render_json(report) + "\n", encoding="utf-8")

    if json_output:
        print(render_json(report))
    else:
        print(render_terminal(report))

    return 1 if report.findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
