// Tolerant stub for unused Privy optional deps (@base-org/account, x402/client).
//
// An empty object ({}) made Privy throw "TypeError: e is not a function" during
// initialize() — it probes these modules and calls an export that didn't exist.
// This Proxy resolves ANY import (default or named) to a callable no-op, so
// Privy's init can't blow up on a stubbed dependency we don't use.
const noop = function () {}

module.exports = new Proxy(noop, {
  get(_target, prop) {
    if (prop === "__esModule") return true
    if (prop === "default") return noop
    return noop
  },
})
