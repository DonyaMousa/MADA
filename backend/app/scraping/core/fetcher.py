import time
from pathlib import Path
from urllib.parse import urlsplit, urljoin
from urllib.robotparser import RobotFileParser
import httpx
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_exponential
from ..schemas.scholarship import Evidence
from ..storage.json_repository import content_hash, save_json, utcnow

ALLOWED_HOSTS = {"www2.daad.de", "www.daad.de", "static.daad.de", "daad.de", "www.meindaad.de"}


class AccessRestricted(RuntimeError):
    pass


class TransientFetchError(RuntimeError):
    pass


class Fetcher:
    """Serial, robot-aware requests. No CAPTCHA, auth, proxy or block bypass."""
    def __init__(self, raw_dir: Path, delay=1.25, client=None, max_bytes=12_000_000):
        self.raw_dir = raw_dir
        self.delay = max(1.0, delay)
        self.max_bytes = max_bytes
        self.client = client or httpx.Client(timeout=35, follow_redirects=False,
            headers={"User-Agent": "MadaScholarshipResearch/0.1 (academic scholarship catalogue; polite bounded crawl)",
                     "Accept-Language": "en"})
        self.last_request = 0.0
        self.robots = {}
        self.evidence = []
        self.failures = []
        self.requests_log = []

    @staticmethod
    def check_url(url):
        p = urlsplit(url)
        if p.scheme != "https" or p.hostname not in ALLOWED_HOSTS or p.username or p.password or p.port not in (None, 443):
            raise AccessRestricted(f"URL outside official HTTPS allowlist: {url}")
        if any(x in p.path.lower() for x in ("/login", "/signin", "/authentication")):
            raise AccessRestricted(f"Authenticated portal is outside crawl scope: {url}")

    def _request(self, method, url, data=None):
        self.check_url(url)
        time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        # Stream to enforce the size limit before materializing a response/PDF.
        with self.client.stream(method, url, data=data) as streamed:
            chunks, size = [], 0
            for chunk in streamed.iter_bytes():
                size += len(chunk)
                if size > self.max_bytes:
                    raise AccessRestricted(f"Response exceeds {self.max_bytes} bytes: {url}")
                chunks.append(chunk)
            decoded_headers = {k: v for k, v in streamed.headers.items() if k not in ("content-encoding", "content-length")}
            response = httpx.Response(streamed.status_code, headers=decoded_headers,
                content=b"".join(chunks), request=streamed.request)
        digest = content_hash(response.content)
        suffix = ".pdf" if "application/pdf" in response.headers.get("content-type", "") else ".html"
        target = self.raw_dir / f"{digest}{suffix}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(response.content)
        evidence = Evidence(url=str(response.url), method=method, retrieved_at=utcnow(),
            status_code=response.status_code, sha256=digest, local_path=target.as_posix(),
            request_data=data, content_type=response.headers.get("content-type"))
        self.evidence.append(evidence)
        self.requests_log.append(evidence.model_dump(mode="json"))
        return response

    def _robots_allowed(self, url):
        p = urlsplit(url)
        origin = f"{p.scheme}://{p.netloc}"
        if origin not in self.robots:
            response = self._request("GET", origin + "/robots.txt")
            parser = RobotFileParser(origin + "/robots.txt")
            if response.status_code in (404, 410):
                parser.parse([])  # Explicitly absent robots.txt; record the actual response.
            elif response.status_code == 200 and "<html" not in response.text[:200].lower():
                parser.parse(response.text.splitlines())
            else:
                raise AccessRestricted(f"Cannot establish robots policy: HTTP {response.status_code} at {origin}/robots.txt")
            self.robots[origin] = parser
        parser = self.robots[origin]
        self.delay = max(self.delay, parser.crawl_delay("MadaScholarshipResearch") or parser.crawl_delay("*") or 0)
        return parser.can_fetch("MadaScholarshipResearch", url)

    def fetch(self, url, method="GET", data=None):
        self.check_url(url)
        try:
            if not self._robots_allowed(url):
                raise AccessRestricted(f"robots.txt disallows {url}")
            for attempt in Retrying(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, max=8),
                retry=retry_if_exception_type((httpx.TransportError, TransientFetchError)), reraise=True):
                with attempt:
                    current, verb, body = url, method, data
                    for _ in range(6):
                        if not self._robots_allowed(current):
                            raise AccessRestricted(f"robots.txt disallows redirect: {current}")
                        response = self._request(verb, current, body)
                        if response.status_code in (401, 403):
                            raise AccessRestricted(f"HTTP {response.status_code}: {current}")
                        if response.status_code == 429:
                            # Stop this resource rather than evade or repeatedly hit rate limiting.
                            raise AccessRestricted(f"Rate limited (429), Retry-After={response.headers.get('retry-after')}: {current}")
                        if 500 <= response.status_code <= 599:
                            raise TransientFetchError(f"HTTP {response.status_code}: {current}")
                        if response.is_redirect:
                            current = urljoin(current, response.headers["location"])
                            self.check_url(current)
                            if response.status_code in (301, 302, 303):
                                verb, body = "GET", None
                            continue
                        response.raise_for_status()
                        if "captcha" in response.text[:5000].lower() and "scholarship" not in response.text[:5000].lower():
                            raise AccessRestricted(f"Possible CAPTCHA at {current}")
                        return response
                    raise AccessRestricted(f"Too many redirects at {url}")
        except Exception as exc:
            self.failures.append({"url": url, "method": method, "error": str(exc), "retrieved_at": utcnow().isoformat()})
            raise

    def close(self):
        save_json(self.raw_dir.parent / "reports" / "daad_request_log.json", self.requests_log)
        self.client.close()
