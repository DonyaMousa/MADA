import gzip
import httpx
import pytest
from app.scraping.core.fetcher import Fetcher, AccessRestricted


def make_fetcher(tmp_path, monkeypatch, handler):
    monkeypatch.setattr("app.scraping.core.fetcher.time.sleep", lambda _: None)
    return Fetcher(tmp_path, client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_network_failure_is_recorded(tmp_path, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("offline fixture", request=request)
    f = make_fetcher(tmp_path, monkeypatch, handler)
    with pytest.raises(httpx.ConnectError): f.fetch("https://www2.daad.de/test")
    assert f.failures and "offline fixture" in f.failures[0]["error"]


def test_robots_restriction_not_bypassed(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(200, text="User-agent: *\nDisallow: /blocked")
    f = make_fetcher(tmp_path, monkeypatch, handler)
    with pytest.raises(AccessRestricted, match="robots"):
        f.fetch("https://www2.daad.de/blocked")


def test_missing_robots_permits_public_request(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(404 if request.url.path == "/robots.txt" else 200, text="public page")
    f = make_fetcher(tmp_path, monkeypatch, handler)
    assert f.fetch("https://www2.daad.de/test").text == "public page"


def test_gzip_is_not_decoded_twice(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(404) if request.url.path == "/robots.txt" else httpx.Response(200,
            headers={"Content-Encoding": "gzip"}, content=gzip.compress(b"Scholarship content"))
    f = make_fetcher(tmp_path, monkeypatch, handler)
    assert f.fetch("https://www2.daad.de/test").text == "Scholarship content"


def test_redirect_to_unapproved_host_stops(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(404) if request.url.path == "/robots.txt" else httpx.Response(302, headers={"Location": "https://evil.example/"})
    with pytest.raises(AccessRestricted):
        make_fetcher(tmp_path, monkeypatch, handler).fetch("https://www2.daad.de/test")


@pytest.mark.parametrize("status", [401, 403, 429])
def test_access_restrictions_stop_without_retry(tmp_path, monkeypatch, status):
    calls = []
    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(404) if request.url.path == "/robots.txt" else httpx.Response(status)
    with pytest.raises(AccessRestricted):
        make_fetcher(tmp_path, monkeypatch, handler).fetch("https://www2.daad.de/test")
    assert calls.count("/test") == 1


def test_transient_server_failure_retries_are_bounded(tmp_path, monkeypatch):
    calls = []
    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(404) if request.url.path == "/robots.txt" else httpx.Response(503)
    from app.scraping.core.fetcher import TransientFetchError
    with pytest.raises(TransientFetchError):
        make_fetcher(tmp_path, monkeypatch, handler).fetch("https://www2.daad.de/test")
    assert calls.count("/test") == 3


def test_response_size_limit(tmp_path, monkeypatch):
    def handler(request):
        return httpx.Response(404) if request.url.path == "/robots.txt" else httpx.Response(200, content=b"x" * 101)
    fetcher = make_fetcher(tmp_path, monkeypatch, handler)
    fetcher.max_bytes = 100
    with pytest.raises(AccessRestricted, match="exceeds"):
        fetcher.fetch("https://www2.daad.de/test")
