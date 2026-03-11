# UjamaaDAO – Frontend Payment UX Design

**Version:** 1.0
**Last updated:** March 2026
**Scope:** How payment and contribution flows should look and feel across the app.

> **Guiding principle**: Hide complexity. Show only the most relevant path first. Default to M-Pesa for all Kenyan users.

---

## Core Rules

1. **Always one default visible method** — M-Pesa for 95% of users
2. **Token option is secondary** — small link or toggle, only shown if user has fiat-backed UT balance > 0
3. **Never show both payment forms at the same time** — use a switch or "Pay another way" link
4. **Pre-fill amounts** wherever possible (suggested amounts, exact dues)
5. **Clear value messaging:**
   - "M-Pesa – instant and familiar"
   - "Utility Tokens – faster, no M-Pesa fees"
6. **Progressive disclosure** — reveal advanced options only when needed
7. **One-tap switch** when needed — never force users through a modal or new screen just to change method

---

## Screen Examples

### Contributing to a Ward Project

**Screen: "Support the Youth Training Project"**
Goal: Raise KSh 50,000

```
[Progress bar: KSh 12,400 / 50,000 raised]

Contribute via:

  [Pay with M-Pesa]          ← big green button, always first
  Enter amount: [500] [1,000] [5,000] [custom]
  "Pay directly to ward trainer's till"

  [small link — only if fiatUt > 0]
  "Or use Utility Tokens (you have 3,200 UT)"

  ↓ if tapped →
  [Contribute with Utility Tokens]
  Enter amount in UT: ______
  "1 UT ≈ KSh 1"
  [Confirm]
```

Result: 95% of users never see the token option. Clean, no clutter.

---

### Marketplace Listing Payment

**Screen: "Fresh Tomatoes – KSh 200/kg"**

```
Seller: Mama Njeri ✓  4.8 ★
Price: KSh 200/kg
Quantity: [5 kg]  →  Total: KSh 1,000

  [Pay with M-Pesa]          ← default
  "Send KSh 1,000 to Till XXXX – Ref: 123456"

  [small button — only if fiatUt ≥ 1,000]
  "Pay with Utility Tokens (1,000 UT)"
  "Faster · no M-Pesa fees · you have 3,200 UT"
```

---

### Monthly Commitment Dues

**Screen: "Your February Dues – KSh 500"**

```
Due: 28 Feb 2026
Amount: KSh 500
Penalty if late: –20 PR

  [Pay with M-Pesa]          ← default
  [STK push to 07XX XXX XXX]

  [small link — only if fiatUt ≥ 500]
  "Pay with Utility Tokens (500 UT)"
```

---

### UT Cash-Out (Fiat-backed only)

**Wallet screen:**

```
UT Balance
  Fiat-backed  3,450 UT   ≈ KSh 3,450  [Cash Out]
  Earned         850 UT   platform perks only

[Cash Out] → opens cash-out screen:

Amount: [3,450] (max)  or  [500] [1,000] [2,000] [All]
To: 07XX XXX XXX  (pre-filled, editable)
Fee: 1%  →  You receive: KSh 3,415.50

[Withdraw to M-Pesa]
```

**Never show earned UT with a cash-out option.** Label it clearly: "platform perks only."

---

## What to Never Do

- Do not show multiple payment radio buttons all visible at once
- Do not show UT option if user's fiat-backed UT balance is 0
- Do not confuse fiat-backed UT and earned UT in the same balance display
- Do not use the word "wallet" for the fiat-backed pool without explaining it
- Do not show crypto/blockchain terminology to users unless they have explicitly opted into advanced mode

---

## Internationalisation Notes

- All KES amounts: format as "KSh X,XXX" (not "KES" or bare numbers)
- M-Pesa is the primary frame of reference — use "M-Pesa" not "mobile money"
- Swahili labels planned: "Lipa kwa M-Pesa", "Thibitisha malipo"
- Amounts: comma thousands separator (KSh 1,000 not KSh 1000)
