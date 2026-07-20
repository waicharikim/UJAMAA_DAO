// Inline, ES5-safe boot script injected as the FIRST element in <head> so it
// runs before the main JS bundle. Its job: catch the class of failure that
// Sentry structurally CANNOT see — an old/in-app-browser engine that can't
// parse the modern bundle (or never executes the ES-module scripts at all).
// In those cases the Sentry browser SDK never loads, so the page just
// white-screens with zero telemetry.
//
// This script:
//   1. Registers error/rejection listeners (capture phase) before the bundle.
//   2. Beacons fatal parse/load failures — and UA — to /api/client-error,
//      which forwards them to Sentry server-side (real prod visibility).
//   3. Runs a watchdog: if React never sets window.__UJAMAA_APP_MOUNTED, it
//      reports a "no-mount" event (covers engines too old to even fire an
//      error) and replaces the blank page with a readable fallback.
//
// Must stay dependency-free and ES5 (no const/let, arrow fns, template
// literals, optional chaining) — it has to parse on the very engines we're
// trying to diagnose.
const BOOT_SCRIPT = `(function () {
  var BEACON = "/api/client-error";
  var FALLBACK_ID = "ujamaa-boot-fallback";
  var reported = false;

  function isFatal(msg) {
    if (!msg) return false;
    return /SyntaxError|Unexpected token|Unexpected identifier|ChunkLoadError|Loading chunk|Loading CSS chunk|error loading dynamically imported module|Importing a module script failed|is not a function|undefined is not|null is not an object|can't find variable|Can't find variable/i.test(msg);
  }

  function beacon(kind, msg, src, line, col, stack) {
    if (reported) return;
    reported = true;
    try {
      var payload = {
        kind: kind,
        message: msg ? String(msg) : "",
        source: src ? String(src) : "",
        lineno: line || 0,
        colno: col || 0,
        stack: stack ? String(stack).slice(0, 2000) : "",
        href: location.href,
        ua: navigator.userAgent
      };
      var body = JSON.stringify(payload);
      if (navigator && navigator.sendBeacon) {
        navigator.sendBeacon(BEACON, new Blob([body], { type: "application/json" }));
      } else if (window.XMLHttpRequest) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", BEACON, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(body);
      }
    } catch (e) {}
  }

  function showFallback() {
    if (window.__UJAMAA_APP_MOUNTED) return;
    if (document.getElementById(FALLBACK_ID)) return;
    if (!document.body) return;
    var el = document.createElement("div");
    el.id = FALLBACK_ID;
    el.setAttribute("style", "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#F7F2E8;color:#1D4731;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;");
    el.innerHTML = '<div style="max-width:340px"><div style="font-size:22px;font-weight:700;margin-bottom:10px">UjamaaDAO</div><div style="font-size:15px;line-height:1.55;margin-bottom:18px">This page could not load fully on your browser. Please update your browser (or open it in Chrome), then reload.</div><button id="ujamaa-boot-reload" style="background:#1D4731;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;cursor:pointer">Reload</button></div>';
    document.body.appendChild(el);
    var btn = document.getElementById("ujamaa-boot-reload");
    if (btn) btn.onclick = function () { window.location.reload(); };
  }

  window.addEventListener("error", function (e) {
    var msg = e && e.message;
    var tgt = e && e.target;
    // Resource-load failures (a missing JS/CSS chunk) fire on the element and
    // carry no message — synthesise one so we still capture them.
    if ((!msg || msg === "") && tgt && (tgt.src || tgt.href)) {
      msg = "Resource failed to load: " + (tgt.src || tgt.href);
    }
    if (!isFatal(msg)) return;
    beacon("early-error", msg, e && e.filename, e && e.lineno, e && e.colno, e && e.error && e.error.stack);
    setTimeout(showFallback, 1500);
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    var msg = (r && (r.message || r.name)) || (typeof r === "string" ? r : "");
    if (!isFatal(msg)) return;
    beacon("unhandledrejection", msg, "", 0, 0, r && r.stack);
    setTimeout(showFallback, 1500);
  });

  // Watchdog: if React hasn't mounted after 8s, the bundle silently failed
  // (engine too old to even throw a catchable error). Report UA + show fallback.
  setTimeout(function () {
    if (window.__UJAMAA_APP_MOUNTED) return;
    beacon("no-mount", "App did not mount within 8s", "", 0, 0, "");
    showFallback();
  }, 8000);
})();`

export function EarlyErrorBoot() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
}
