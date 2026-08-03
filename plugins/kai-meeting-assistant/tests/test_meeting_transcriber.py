import sys
import types
from pathlib import Path
import ssl
import inspect

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
SERVER_DIR = PLUGIN_ROOT / "mcp-servers" / "meeting-transcriber"
sys.path.insert(0, str(SERVER_DIR))

from server import run_mcp_server, transcribe_file


class FakeModel:
    def transcribe(self, audio_path, fp16=False, language=None, verbose=False):
        assert fp16 is False
        assert verbose is False
        return {
            "language": "en",
            "text": "Alice will ship the demo.",
            "segments": [
                {"start": 0, "end": 1.25, "text": " Alice will ship the demo. "},
            ],
        }


def test_transcribe_file_uses_whisper_and_returns_segments(tmp_path, monkeypatch):
    audio_path = tmp_path / "meeting.wav"
    audio_path.write_bytes(b"RIFF....WAVE")
    fake_whisper = types.SimpleNamespace(load_model=lambda model_name, download_root=None: FakeModel())
    monkeypatch.setitem(sys.modules, "whisper", fake_whisper)

    result = transcribe_file(str(audio_path), meeting_id="meeting-1", model_name="base")

    assert result["meetingId"] == "meeting-1"
    assert result["engine"] == "openai-whisper"
    assert result["text"] == "Alice will ship the demo."
    assert result["segments"] == [
        {"start": 0.0, "end": 1.25, "text": "Alice will ship the demo."},
    ]


def test_transcribe_file_uses_system_certificate_store_before_model_download(tmp_path, monkeypatch):
    audio_path = tmp_path / "meeting.wav"
    audio_path.write_bytes(b"RIFF....WAVE")
    injected = {"value": False}

    fake_truststore = types.SimpleNamespace(
        inject_into_ssl=lambda: injected.__setitem__("value", True),
    )

    def load_model(model_name, download_root=None):
        assert injected["value"] is True
        return FakeModel()

    monkeypatch.delenv("SSL_CERT_FILE", raising=False)
    monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)
    monkeypatch.delenv("XIAOK_MEETING_ALLOW_INSECURE_MODEL_DOWNLOAD", raising=False)
    monkeypatch.setitem(sys.modules, "truststore", fake_truststore)
    monkeypatch.setitem(sys.modules, "whisper", types.SimpleNamespace(load_model=load_model))

    result = transcribe_file(str(audio_path), meeting_id="meeting-1", model_name="base")

    assert result["text"] == "Alice will ship the demo."


def test_transcribe_file_reports_model_download_ssl_failure(tmp_path, monkeypatch):
    audio_path = tmp_path / "meeting.wav"
    audio_path.write_bytes(b"RIFF....WAVE")

    def load_model(model_name, download_root=None):
        raise ssl.SSLCertVerificationError(
            "certificate verify failed: self signed certificate in certificate chain"
        )

    monkeypatch.setitem(sys.modules, "whisper", types.SimpleNamespace(load_model=load_model))

    try:
        transcribe_file(str(audio_path), meeting_id="meeting-1", model_name="base")
    except RuntimeError as exc:
        assert str(exc) == "whisper_model_download_ssl_failed"
    else:
        raise AssertionError("expected RuntimeError")


def test_transcribe_file_reports_missing_audio():
    try:
        transcribe_file("/missing/meeting.wav")
    except RuntimeError as exc:
        assert str(exc) == "audio_file_missing"
    else:
        raise AssertionError("expected RuntimeError")


def test_requirements_include_mcp_server_runtime():
    requirements = (
        PLUGIN_ROOT / "mcp-servers" / "meeting-transcriber" / "requirements.txt"
    ).read_text(encoding="utf-8").splitlines()

    assert "mcp==1.27.1" in requirements
    assert "pydantic==2.13.4" in requirements


def test_mcp_tool_annotations_are_resolvable(monkeypatch):
    instances = []

    class FakeFastMCP:
        def __init__(self, **_kwargs):
            self.ran = False
            instances.append(self)

        def tool(self):
            def register(function):
                inspect.signature(function, eval_str=True)
                return function

            return register

        def run(self):
            self.ran = True

    fake_server_module = types.ModuleType("mcp.server")
    fake_server_module.FastMCP = FakeFastMCP
    monkeypatch.setitem(sys.modules, "mcp.server", fake_server_module)

    run_mcp_server()

    assert len(instances) == 1
    assert instances[0].ran is True
