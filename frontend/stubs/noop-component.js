// No-op React component stub.
//
// Used to replace Privy UI screens we don't use (e.g. DelegatedActionsConsentScreen)
// that import lucide-react icons missing from our pinned v0.294. The previous stub
// (`stubs/empty.js` → `module.exports = {}`) returned an *empty object*; when Privy
// rendered it as a component React threw "Element type is invalid", which crashed the
// modal mid-flow and left its dark backdrop covering the app — a black screen.
//
// Returning a valid component that renders `null` lets Privy's modal flow proceed and
// close cleanly. A Proxy makes every default/named import resolve to the same no-op,
// so this works regardless of how the replaced module is imported.
const Noop = () => null;

module.exports = new Proxy(Noop, {
  get(target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return Noop;
    return Noop;
  },
});
