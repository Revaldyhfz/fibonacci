from fastapi import FastAPI
from pydantic import BaseModel
import psycopg2
import os
from dotenv import load_dotenv
from collections import Counter
from datetime import datetime, time

# Load Django environment variables
load_dotenv(dotenv_path="../.env")

app = FastAPI(title="Fibonacci Analytics Service")

DB_NAME = os.getenv("DB_NAME", "fibonacci")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

@app.get("/")
def root():
    return {"message": "Advanced Analytics microservice is running"}

@app.get("/stats/overall")
def get_overall_stats():
    """Compute detailed trading analytics from the DB."""
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            symbol, strategy_id, pnl, pnl_percent, time,
            (CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS winner
        FROM core_trade
        WHERE pnl IS NOT NULL
    """)
    trades = cur.fetchall()
    cur.close()
    conn.close()

    if not trades:
        return {"message": "No trades available"}

    # Convert to structured list
    data = [
        {
            "symbol": t[0],
            "strategy_id": t[1],
            "pnl": float(t[2]),
            "pnl_percent": float(t[3]),
            "time": str(t[4]),
            "is_winner": bool(t[5])
        }
        for t in trades
    ]

    total_trades = len(data)
    wins = sum(1 for t in data if t["is_winner"])
    losses = total_trades - wins
    total_pnl = sum(t["pnl"] for t in data)
    avg_win = sum(t["pnl"] for t in data if t["pnl"] > 0) / wins if wins else 0
    avg_loss = sum(t["pnl"] for t in data if t["pnl"] < 0) / losses if losses else 0
    best_trade = max(data, key=lambda x: x["pnl"])
    worst_trade = min(data, key=lambda x: x["pnl"])
    most_traded_symbol = Counter(t["symbol"] for t in data).most_common(1)[0][0]

    # --- Session classification ---
    def get_session(time_str):
        """Return session name (Asia, London, New York) based on hour of day."""
        if not time_str or time_str.lower() == "none":
            return "Unknown"
        try:
            # Extract hour safely
            h = int(str(time_str).split(":")[0])
        except (ValueError, TypeError):
            return "Unknown"

        if 0 <= h < 8:
            return "Asia"
        elif 8 <= h < 16:
            return "London"
        elif 16 <= h < 24:
            return "New York"
        else:
            return "Unknown"
    session_stats = Counter(get_session(t["time"]) for t in data)
    most_successful_session = max(
        session_stats.keys(), key=lambda s: session_stats[s]
    )

    # --- Strategy performance ---
    strategy_perf = {}
    for t in data:
        sid = t["strategy_id"] or "Unknown"
        if sid not in strategy_perf:
            strategy_perf[sid] = {"wins": 0, "count": 0, "pnl": 0}
        strategy_perf[sid]["count"] += 1
        strategy_perf[sid]["pnl"] += t["pnl"]
        if t["is_winner"]:
            strategy_perf[sid]["wins"] += 1

    for sid in strategy_perf:
        s = strategy_perf[sid]
        s["winrate"] = round((s["wins"] / s["count"]) * 100, 2)
        s["avg_pnl"] = round(s["pnl"] / s["count"], 2)

    return {
        "total_trades": total_trades,
        "winrate_percent": round((wins / total_trades) * 100, 2),
        "total_pnl": round(total_pnl, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "best_trade": best_trade,
        "worst_trade": worst_trade,
        "most_traded_symbol": most_traded_symbol,
        "most_successful_session": most_successful_session,
        "strategy_performance": strategy_perf
    }
    
@app.get("/stats/session")
def get_session_stats():
    """Return PnL, winrate, and trade count grouped by trading session."""
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT pnl, time FROM core_trade WHERE pnl IS NOT NULL;
    """)
    trades = cur.fetchall()
    cur.close()
    conn.close()

    def classify_session(time_str):
        if not time_str or time_str.lower() == "none":
            return "Unknown"
        try:
            h = int(str(time_str).split(":")[0])
        except (ValueError, TypeError):
            return "Unknown"
        if 0 <= h < 8:
            return "Asia"
        elif 8 <= h < 16:
            return "London"
        elif 16 <= h < 24:
            return "New York"
        else:
            return "Unknown"

    stats = {}
    for pnl, t in trades:
        session = classify_session(str(t))
        if session not in stats:
            stats[session] = {"count": 0, "wins": 0, "pnl": 0}
        stats[session]["count"] += 1
        stats[session]["pnl"] += float(pnl)
        if pnl > 0:
            stats[session]["wins"] += 1

    for s in stats.values():
        s["winrate"] = round((s["wins"] / s["count"]) * 100, 2)
        s["avg_pnl"] = round(s["pnl"] / s["count"], 2)

    return stats


@app.get("/stats/symbol")
def get_symbol_stats():
    """Return performance metrics grouped by trading symbol."""
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT symbol, pnl FROM core_trade WHERE pnl IS NOT NULL;
    """)
    trades = cur.fetchall()
    cur.close()
    conn.close()

    stats = {}
    for symbol, pnl in trades:
        if symbol not in stats:
            stats[symbol] = {"count": 0, "wins": 0, "pnl": 0}
        stats[symbol]["count"] += 1
        stats[symbol]["pnl"] += float(pnl)
        if pnl > 0:
            stats[symbol]["wins"] += 1

    for s in stats.values():
        s["winrate"] = round((s["wins"] / s["count"]) * 100, 2)
        s["avg_pnl"] = round(s["pnl"] / s["count"], 2)

    return stats


@app.get("/stats/equity_curve")
def get_equity_curve():
    """Return cumulative PnL per trade_date for plotting."""
    conn = psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT trade_date, pnl
        FROM core_trade
        WHERE pnl IS NOT NULL
        ORDER BY trade_date ASC;
    """)
    trades = cur.fetchall()
    cur.close()
    conn.close()

    curve = []
    cumulative = 0
    for trade_date, pnl in trades:
        cumulative += float(pnl)
        curve.append({
            "date": str(trade_date.date() if trade_date else "Unknown"),
            "equity": round(cumulative, 2)
        })

    return curve