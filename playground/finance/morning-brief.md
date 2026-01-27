---
name: finance-morning-brief
description: Generate a morning trading brief from multiple data sources
---

# R1
Give me a morning trading brief for my watchlist: TSLA, SOL.

# R1 follow up
That's too basic. I need you to follow a more rigorous anlaysis pattern like an expert financial analyst.

## Authoritative Sources Only

**Only use these domains** - do not use generic aggregator sites:

- **Stock Prices/Technicals**: `finance.yahoo.com`, `tradingview.com`
- **Insider Trades**: `sec.gov` (EDGAR Form 4 filings only)
- **Congressional Trades**: `capitoltrades.com`
- **Crypto Prices**: `coingecko.com`, `coinmarketcap.com`
- **News**: Primary sources (company IR, Reuters, Bloomberg)
- **Social Sentiment**: `reddit.com`, `x.com`

## Procedure (Follow This Order)

**Step 1: Stocks** - For each: price/volume, 14-period RSI, 30-day support/resistance, SEC Form 4 filings (>$100k), Capitol Trades, material news, Reddit/X sentiment
**Step 2: Crypto** - For each: price/volume, 14-period RSI, 30-day support/resistance, whale wallets, protocol news, Reddit sentiment
**Step 3: Apply Alert Thresholds** - Only surface if crossed:

- 🔴 **Price move**: > 3% either direction
- 🔴 **RSI extreme**: > 70 (overbought) or < 30 (oversold)
- 🔴 **Insider trade**: > $100k transaction
- 🔴 **Congressional trade**: Any amount
- 🔴 **Breaking news**: Material events only
- 🟡 **Near support/resistance**: Within 5% of key level
- 🟡 **Whale movement**: > $1M SOL / > $10M BTC
- 🟡 **Sentiment extreme**: Viral/trending discussion

**Step 4: Compose Brief** - Use this exact format:

```markdown
# Morning Brief - {date}

## Alerts
[Only items crossing thresholds - omit section entirely if none]

🔴 {TICKER} {signal description}
🟡 {TICKER} {signal description}

## Watchlist

**{TICKER 1}** ${price} ({change}%) · RSI {value} · {alert status}
**{TICKER 2}** ...
```

## Delivery
Send to my discord via webhook (in env var).

---

# R2
add to my morning brief: Google, BTC