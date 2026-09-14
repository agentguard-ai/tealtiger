"""HTTP adapter for the deterministic KYC example primitives."""

from dataclasses import asdict
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agents.document_extractor import DocumentExtractionError, extract_identity_mock
from agents.sanctions_screener import SanctionsScreeningError, screen_sanctions

app = FastAPI(title="Deterministic KYC Demo")


class ExtractionRequest(BaseModel):
    """The structured document shape accepted by the deterministic extractor."""

    document: dict[str, Any]


class SanctionsRequest(BaseModel):
    """The identity fields used for local synthetic sanctions screening."""

    name: str
    dob: str = ""
    nationality: str = ""


@app.exception_handler(RequestValidationError)
async def request_validation_error(
    _request: Request, _error: RequestValidationError
) -> JSONResponse:
    """Avoid echoing potentially sensitive request values in validation errors."""
    return JSONResponse(status_code=422, content={"detail": "Invalid request"})


@app.get("/health")
async def health() -> dict[str, str]:
    """Report whether the local demo service can accept requests."""
    return {"status": "ok"}


@app.post("/extract")
async def extract(request: ExtractionRequest) -> dict[str, dict[str, Any]]:
    """Extract an identity without enabling the optional LLM path."""
    try:
        identity = extract_identity_mock(request.document)
    except DocumentExtractionError as error:
        raise HTTPException(status_code=422, detail="Invalid request") from error
    return {"identity": identity.to_dict()}


@app.post("/sanctions")
async def sanctions(request: SanctionsRequest) -> dict[str, dict[str, Any]]:
    """Screen an identity against the bundled synthetic sanctions fixture."""
    try:
        result = await screen_sanctions(request.name, request.dob, request.nationality)
    except SanctionsScreeningError as error:
        raise HTTPException(status_code=422, detail="Invalid request") from error
    return {"result": asdict(result)}
