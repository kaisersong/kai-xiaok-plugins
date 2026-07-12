"""Local meeting transcription server.

The desktop app calls the CLI subcommand directly for deterministic production
flows. When launched with no subcommand, this file also exposes a small MCP
stdio server for future plugin-tool use.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import ssl
import sys
from pathlib import Path
from typing import Any


def configure_model_download_tls() -> None:
    """Configure TLS for model downloads before Whisper calls urllib."""
    if os.environ.get("XIAOK_MEETING_ALLOW_INSECURE_MODEL_DOWNLOAD") == "1":
        ssl._create_default_https_context = ssl._create_unverified_context
        return

    if os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE"):
        return

    try:
        import truststore  # type: ignore

        truststore.inject_into_ssl()
        return
    except Exception:
        pass

    try:
        import certifi  # type: ignore

        cert_path = certifi.where()
        os.environ.setdefault("SSL_CERT_FILE", cert_path)
        os.environ.setdefault("REQUESTS_CA_BUNDLE", cert_path)
    except Exception:
        pass


def is_ssl_certificate_error(error: BaseException) -> bool:
    if isinstance(error, ssl.SSLError):
        return True
    message = str(error).lower()
    return "certificate_verify_failed" in message or "certificate verify failed" in message


def transcribe_file(
    audio_path: str,
    meeting_id: str = "",
    model_name: str = "base",
    language: str | None = None,
) -> dict[str, Any]:
    path = Path(audio_path)
    if not path.exists() or not path.is_file():
        raise RuntimeError("audio_file_missing")

    try:
        import whisper  # type: ignore
    except Exception as exc:
        raise RuntimeError("missing_whisper") from exc

    cache_dir = os.environ.get("XIAOK_MEETING_WHISPER_CACHE")
    configure_model_download_tls()
    try:
        model = whisper.load_model(model_name, download_root=cache_dir)
    except Exception as exc:
        if is_ssl_certificate_error(exc):
            raise RuntimeError("whisper_model_download_ssl_failed") from exc
        raise
    with contextlib.redirect_stdout(sys.stderr):
        result = model.transcribe(
            str(path),
            fp16=False,
            language=language or None,
            verbose=False,
        )

    raw_segments = result.get("segments") or []
    segments: list[dict[str, Any]] = []
    for item in raw_segments:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        segments.append({
            "start": float(item.get("start") or 0),
            "end": float(item.get("end") or 0),
            "text": text,
        })

    text = str(result.get("text") or "").strip()
    if not text and segments:
        text = " ".join(segment["text"] for segment in segments)

    return {
        "meetingId": meeting_id,
        "engine": "openai-whisper",
        "model": model_name,
        "language": result.get("language"),
        "text": text,
        "segments": segments,
    }


def run_cli(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="meeting-transcriber")
    subparsers = parser.add_subparsers(dest="command", required=True)

    transcribe = subparsers.add_parser("transcribe-file")
    transcribe.add_argument("audio_path")
    transcribe.add_argument("--meeting-id", default="")
    transcribe.add_argument("--model", default=os.environ.get("XIAOK_MEETING_WHISPER_MODEL", "base"))
    transcribe.add_argument("--language", default=None)

    args = parser.parse_args(argv)
    try:
        if args.command == "transcribe-file":
            payload = transcribe_file(
                args.audio_path,
                meeting_id=args.meeting_id,
                model_name=args.model,
                language=args.language,
            )
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            sys.stdout.write("\n")
            return 0
    except Exception as exc:
        sys.stderr.write(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.stderr.write("\n")
        return 1

    sys.stderr.write(json.dumps({"error": "unknown_command"}))
    sys.stderr.write("\n")
    return 1


def run_mcp_server() -> None:
    try:
        from mcp.server import FastMCP  # type: ignore
        from pydantic import BaseModel, Field  # type: ignore
    except Exception as exc:
        raise RuntimeError("missing_mcp_runtime") from exc

    mcp = FastMCP(
        name="meeting-transcriber",
        instructions="Local microphone-recording transcription for xiaok desktop.",
    )

    class Segment(BaseModel):
        start: float = Field(description="Segment start time in seconds")
        end: float = Field(description="Segment end time in seconds")
        text: str = Field(description="Transcript text")

    class TranscriptionResult(BaseModel):
        meetingId: str = Field(description="Meeting id")
        engine: str = Field(description="Transcription engine")
        model: str = Field(description="Model id")
        language: str | None = Field(default=None, description="Detected language")
        text: str = Field(description="Full transcript")
        segments: list[Segment] = Field(description="Timestamped transcript segments")

    @mcp.tool()
    def transcribe_file_tool(
        audio_path: str,
        meeting_id: str = "",
        model: str = "base",
        language: str | None = None,
    ) -> TranscriptionResult:
        payload = transcribe_file(audio_path, meeting_id=meeting_id, model_name=model, language=language)
        return TranscriptionResult(**payload)

    mcp.run()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        raise SystemExit(run_cli(sys.argv[1:]))
    run_mcp_server()
