# Refine Prompt (Phase 2)

Use this prompt after Run 1 delivers underwhelming results.

---

That's too basic. I need a comprehensive analysis, but keep the output short. Here's what I want:

## Authoritative Sources Only

**Only use these domains** - do not use generic aggregator sites:

| Data Type | Allowed Sources |
|-----------|-----------------|
| Macro (VIX, 10Y, DXY, Fed) | `fred.stlouisfed.org`, `federalreserve.gov` |
| Stock Prices/Technicals | `finance.yahoo.com`, `tradingview.com` |
| Insider Trades | `sec.gov` (EDGAR Form 4 filings only) |
| Congressional Trades | `capitoltrades.com` |
| Crypto Prices | `coingecko.com`, `coinmarketcap.com` |
| Whale Wallets (SOL) | `solscan.io`, `solana.fm` |
| Whale Wallets (BTC) | `whale-alert.io`, `blockchair.com`, `bitinfocharts.com` |
| News | Primary sources (company IR, Reuters, Bloomberg) |
| Social Sentiment | `reddit.com`, `x.com` |

**Do NOT use**: barchart.com, robinhood.com, tradingeconomics.com, finbold.com, nasdaq.com, investopedia.com, or other aggregator sites.

## Procedure (Follow This Order)

**Step 1: Macro Context** - Query FRED API for these exact series:
- `VIXCLS` → VIX (updates daily)
- `DGS10` → 10-Year Treasury Yield
- `DTWEXBGS` → Dollar Index (broad trade-weighted)
- `DFF` → Federal Funds Rate
- Also find next FOMC meeting date from federalreserve.gov

**Step 2: Stock Data** - For each stock:
1. **Price/Volume**: Yahoo Finance quote (current price, % change, volume vs 10-day avg)
2. **RSI**: Calculate 14-period RSI using adjusted close prices (or use Yahoo Finance technical indicators)
3. **Support/Resistance**: Identify swing highs/lows from last 30 days
4. **Insider Trades**: Query SEC EDGAR for Form 4 filings
   - URL pattern: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=4&dateb=&owner=only&count=10`
   - Look for transactions > $100k in last 30 days
5. **Congressional Trades**: Check Capitol Trades (`capitoltrades.com/trades?ticker={ticker}`)
   - Any trade = alert (regardless of amount)
6. **News**: Search for material events only (earnings surprises, lawsuits, major announcements)
7. **Sentiment**: Search Reddit (`$TSLA` not just "TSLA") and Twitter/X for trending discussions

**Step 3: Crypto Data** - For each crypto:

**SOL (Solana):**
1. **Price/Volume**: CoinGecko API
2. **RSI**: Calculate 14-period RSI or use TradingView
3. **Support/Resistance**: Identify key levels from 30-day range
4. **Whale Wallets**
5. **News**: ETF flows, Protocol updates, partnerships, security incidents
6. **Sentiment**: Search reddit

**Step 4: Apply Alert Thresholds** - Only surface if crossed:

| Signal | Threshold | Priority |
|--------|-----------|----------|
| Price move | > 3% either direction | 🔴 Red |
| RSI extreme | > 70 (overbought) or < 30 (oversold) | 🔴 Red |
| Near support/resistance | Within 5% of key level | 🟡 Yellow |
| Insider trade | > $100k transaction | 🔴 Red |
| Congressional trade | Any amount | 🔴 Red |
| Whale movement | > $1M SOL / > $10M BTC | 🟡 Yellow |
| Breaking news | Material events only | 🔴 Red |
| Sentiment extreme | Viral/trending discussion | 🟡 Yellow |

**Step 5: Compose Brief** - Use this exact format:

```markdown
# Morning Brief - {date}

## Macro
VIX {value} | 10Y {value}% | DXY {value} | Fed {value}% → FOMC {date}

## Alerts
[Only items crossing thresholds - omit section entirely if none]

🔴 {TICKER} {signal description}
🟡 {TICKER} {signal description}

## Watchlist

**{TICKER 1}** ${price} ({change}%) · RSI {value} · {alert status}
**{TICKER 2}** ...

---
Sources: [FRED](hyperlink), [Yahoo Finance](hyperlink), [SEC EDGAR](hyperlink), [CoinGecko](hyperlink), {others used}
Data as of: {timestamp} | Market: {Open/Closed}
```

## Preferences

- **Lead with biggest movers** - if multiple alerts, put highest priority first
- **No fluff** - skip generic news, only material events
- **Contrarian signals welcome** - if sentiment is extremely bullish/bearish, note it
- **Timestamp awareness** - note if data is stale (market closed, API delayed)
- **Be specific** - "CFO sold $320k on 1/14" not "insider selling detected"
- **No tilde for approximation** - use "approx" or round numbers instead of "~" (causes markdown strikethrough)

## What NOT to Include

- Generic company descriptions
- Historical price charts
- Analyst price targets (unless major revision)
- Routine earnings previews (only actual earnings surprises)
- Social posts without significant engagement
- Data from generic aggregator sites (use primary sources)

## Verification Checklist (Internal)

Before outputting, confirm you actually checked:
- [ ] FRED API for all 4 macro indicators (not web search approximations)
- [ ] SEC EDGAR for insider trades (not news articles about insider trades)
- [ ] Capitol Trades for congressional activity (not general news)
- [ ] Solscan/Solana FM for whale wallets (with exchange exclusions applied)
- [ ] RSI calculated from 14-period adjusted close (not arbitrary timeframes)

---

**Key insight for skill encoding:** This prompt teaches BOTH:
1. **Preferences** (what to check) - the data sources and thresholds
2. **Procedural** (how to check) - specific APIs, query formats, exclusion rules
3. **Verification** (prove the work) - checklist + source attribution
