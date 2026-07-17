"""TealTiger governance span exporter for Arize Phoenix.

Exports governance decisions as OpenTelemetry spans that Phoenix
auto-ingests into its LLM trace viewer.

Usage:
    from phoenix.otel import register
    from tealtiger_phoenix import PhoenixGovernanceSpanExporter

    # Register Phoenix tracer
    tracer_provider = register(project_name="my-agent")

    # Create exporter
    exporter = PhoenixGovernanceSpanExporter()

    # Use as on_decision callback
    from tealtiger import observe
    client = observe(OpenAI(), on_decision=exporter.export)
"""

__version__ = "0.1.0"

from tealtiger_phoenix.exporter import PhoenixGovernanceSpanExporter

__all__ = ["PhoenixGovernanceSpanExporter", "__version__"]
