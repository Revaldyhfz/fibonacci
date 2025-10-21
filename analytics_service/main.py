from fastapi import FastAPI
from pydantic import BaseModel
import psycopg2
import os
from dotenv import load_dotenv
from collections import Counter
from datetime import datetime, time
import math
from decimal import Decimal

load_dotenv(dotenv_path="../.env")

app = FastAPI(title="Fibonacci Analytics Service")

DB_NAME = os.getenv("DB_NAME", "fibonacci")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

def get_db_connection():
    return psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        host=DB_HOST, port=DB_PORT
    )

def calculate_advanced_metrics(trades_data):
    """Calculate advanced trading metrics"""
    if not trades_data:
        return {}
    
    # Separate winners and losers
    winners = [t for t in trades_data if t['pnl'] > 0]
    losers = [t for t in trades_data if t['pnl'] < 0]
    
    total_trades = len(trades_data)
    win_count = len(winners)
    loss_count = len(losers)
    
    if total_trades == 0:
        return {}
    
    win_rate = win_count / total_trades if total_trades > 0 else 0
    
    # Basic metrics
    total_pnl = sum(t['pnl'] for t in trades_data)
    avg_win = sum(t['pnl'] for t in winners) / win_count if win_count > 0 else 0
    avg_loss = sum(t['pnl'] for t in losers) / loss_count if loss_count > 0 else 0
    
    # Profit Factor: Gross Profit / Gross Loss
    gross_profit = sum(t['pnl'] for t in winners) if winners else 0
    gross_loss = abs(sum(t['pnl'] for t in losers)) if losers else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    # Expectancy: (AvgWin × WinRate) - (AvgLoss × LossRate)
    loss_rate = 1 - win_rate
    expectancy = (avg_win * win_rate) - (abs(avg_loss) * loss_rate)
    
    # Maximum Drawdown
    equity_curve = []
    cumulative = 0
    for trade in sorted(trades_data, key=lambda x: x['trade_date']):
        cumulative += trade['pnl']
        equity_curve.append(cumulative)
    
    max_drawdown = 0
    max_drawdown_pct = 0
    peak = equity_curve[0] if equity_curve else 0
    
    for equity in equity_curve:
        if equity > peak:
            peak = equity
        drawdown = peak - equity
        drawdown_pct = (drawdown / peak * 100) if peak > 0 else 0
        if drawdown > max_drawdown:
            max_drawdown = drawdown
            max_drawdown_pct = drawdown_pct
    
    # Sharpe Ratio (simplified - assuming risk-free rate of 0)
    returns = [t['pnl'] for t in trades_data]
    avg_return = sum(returns) / len(returns) if returns else 0
    
    if len(returns) > 1:
        variance = sum((r - avg_return) ** 2 for r in returns) / (len(returns) - 1)
        std_dev = math.sqrt(variance) if variance > 0 else 0
        sharpe_ratio = (avg_return / std_dev) if std_dev > 0 else 0
        # Annualize (assuming daily trades)
        sharpe_ratio_annualized = sharpe_ratio * math.sqrt(252)
    else:
        sharpe_ratio_annualized = 0
    
    # Sortino Ratio (only downside deviation)
    negative_returns = [r for r in returns if r < 0]
    if len(negative_returns) > 1:
        downside_variance = sum(r ** 2 for r in negative_returns) / len(negative_returns)
        downside_dev = math.sqrt(downside_variance) if downside_variance > 0 else 0
        sortino_ratio = (avg_return / downside_dev) if downside_dev > 0 else 0
        sortino_ratio_annualized = sortino_ratio * math.sqrt(252)
    else:
        sortino_ratio_annualized = 0
    
    # Calmar Ratio: Annualized Return / Maximum Drawdown
    calmar_ratio = 0
    if max_drawdown > 0:
        # Estimate annualized return
        if trades_data:
            days = (trades_data[-1]['trade_date'] - trades_data[0]['trade_date']).days
            if days > 0:
                annualized_return = (total_pnl / days) * 365
                calmar_ratio = annualized_return / max_drawdown
    
    # Recovery Factor: Net Profit / Max Drawdown
    recovery_factor = total_pnl / max_drawdown if max_drawdown > 0 else 0
    
    # Average R-Multiple (normalized by risk)
    r_multiples = []
    for trade in trades_data:
        if trade.get('entry_price') and trade.get('position_size'):
            # Estimate risk as 1% of entry value (simplified)
            risk = abs(float(trade['entry_price']) * float(trade['position_size']) * 0.01)
            if risk > 0:
                r_multiple = trade['pnl'] / risk
                r_multiples.append(r_multiple)
    
    avg_r = sum(r_multiples) / len(r_multiples) if r_multiples else 0
    
    # Win/Loss Ratio
    win_loss_ratio = abs(avg_win / avg_loss) if avg_loss != 0 else 0
    
    # Consecutive streak analysis
    current_streak = 0
    max_win_streak = 0
    max_loss_streak = 0
    current_is_win = None
    
    for trade in sorted(trades_data, key=lambda x: x['trade_date']):
        is_win = trade['pnl'] > 0
        
        if current_is_win is None or current_is_win == is_win:
            current_streak += 1
        else:
            if current_is_win:
                max_win_streak = max(max_win_streak, current_streak)
            else:
                max_loss_streak = max(max_loss_streak, current_streak)
            current_streak = 1
        
        current_is_win = is_win
    
    # Final streak check
    if current_is_win:
        max_win_streak = max(max_win_streak, current_streak)
    else:
        max_loss_streak = max(max_loss_streak, current_streak)
    
    # Expected longest losing streak (probabilistic)
    expected_loss_streak = 0
    if win_rate < 1.0:
        expected_loss_streak = -math.log(total_trades) / math.log(1 - (1 - win_rate)) if total_trades > 0 else 0
    
    return {
        # Core metrics
        'profit_factor': round(profit_factor, 2),
        'expectancy': round(expectancy, 2),
        'win_loss_ratio': round(win_loss_ratio, 2),
        
        # Risk-adjusted metrics
        'sharpe_ratio': round(sharpe_ratio_annualized, 2),
        'sortino_ratio': round(sortino_ratio_annualized, 2),
        'calmar_ratio': round(calmar_ratio, 2),
        
        # Drawdown metrics
        'max_drawdown': round(max_drawdown, 2),
        'max_drawdown_pct': round(max_drawdown_pct, 2),
        'recovery_factor': round(recovery_factor, 2),
        
        # R-Multiple metrics
        'avg_r_multiple': round(avg_r, 2),
        
        # Streak metrics
        'max_win_streak': max_win_streak,
        'max_loss_streak': max_loss_streak,
        'expected_loss_streak': round(expected_loss_streak, 1),
        
        # Current equity
        'current_equity': round(total_pnl, 2)
    }

@app.get("/")
def root():
    return {"message": "Advanced Analytics microservice is running"}

@app.get("/stats/overall")
def get_overall_stats(time_filter: str = "all"):
    """Compute detailed trading analytics from the DB with time filtering."""
    from datetime import datetime, timedelta
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Build date filter
    date_filter = ""
    if time_filter == "day":
        date_filter = "AND trade_date >= CURRENT_DATE"
    elif time_filter == "week":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '7 days'"
    elif time_filter == "month":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '30 days'"
    
    cur.execute(f"""
        SELECT 
            symbol, strategy_id, pnl, pnl_percent, trade_date, time,
            entry_price, position_size,
            (CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS winner
        FROM core_trade
        WHERE pnl IS NOT NULL {date_filter}
        ORDER BY trade_date ASC
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
            "trade_date": t[4],
            "time": str(t[5]),
            "entry_price": t[6],
            "position_size": t[7],
            "is_winner": bool(t[8])
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

    # Session classification
    def get_session(time_str):
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
    
    session_stats = Counter(get_session(t["time"]) for t in data)
    most_successful_session = max(
        session_stats.keys(), key=lambda s: session_stats[s]
    )

    # Strategy performance
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

    # Calculate advanced metrics
    advanced_metrics = calculate_advanced_metrics(data)

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
        "strategy_performance": strategy_perf,
        "advanced_metrics": advanced_metrics
    }

@app.get("/stats/session")
def get_session_stats(time_filter: str = "all"):
    """Return PnL, winrate, and trade count grouped by trading session."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Build date filter
    date_filter = ""
    if time_filter == "day":
        date_filter = "AND trade_date >= CURRENT_DATE"
    elif time_filter == "week":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '7 days'"
    elif time_filter == "month":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '30 days'"
    
    cur.execute(f"""
        SELECT pnl, time FROM core_trade WHERE pnl IS NOT NULL {date_filter};
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
def get_symbol_stats(time_filter: str = "all"):
    """Return performance metrics grouped by trading symbol."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Build date filter
    date_filter = ""
    if time_filter == "day":
        date_filter = "AND trade_date >= CURRENT_DATE"
    elif time_filter == "week":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '7 days'"
    elif time_filter == "month":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '30 days'"
    
    cur.execute(f"""
        SELECT symbol, pnl FROM core_trade WHERE pnl IS NOT NULL {date_filter};
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
    conn = get_db_connection()
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

@app.get("/stats/hourly")
def get_hourly_stats(time_filter: str = "all"):
    """Return performance by hour of day."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Build date filter
    date_filter = ""
    if time_filter == "day":
        date_filter = "AND trade_date >= CURRENT_DATE"
    elif time_filter == "week":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '7 days'"
    elif time_filter == "month":
        date_filter = "AND trade_date >= CURRENT_DATE - INTERVAL '30 days'"
    
    cur.execute(f"""
        SELECT time, pnl FROM core_trade WHERE pnl IS NOT NULL AND time IS NOT NULL {date_filter};
    """)
    trades = cur.fetchall()
    cur.close()
    conn.close()

    hourly = {}
    for time_val, pnl in trades:
        try:
            hour = int(str(time_val).split(":")[0])
            if hour not in hourly:
                hourly[hour] = {"count": 0, "wins": 0, "pnl": 0}
            hourly[hour]["count"] += 1
            hourly[hour]["pnl"] += float(pnl)
            if pnl > 0:
                hourly[hour]["wins"] += 1
        except (ValueError, TypeError, IndexError):
            continue

    for h in hourly.values():
        h["winrate"] = round((h["wins"] / h["count"]) * 100, 2) if h["count"] > 0 else 0
        h["avg_pnl"] = round(h["pnl"] / h["count"], 2) if h["count"] > 0 else 0

    return hourly