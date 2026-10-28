import os, sqlite3
from datetime import datetime, timezone

DB_PATH = os.getenv("DATABASE_PATH", "nft_rent.sqlite3")

def connect():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with connect() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            item_type TEXT NOT NULL,
            item_name TEXT NOT NULL,
            period TEXT NOT NULL,
            note TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'new',
            created_at TEXT NOT NULL
        )""")
        c.commit()

def create_request(user_id, username, item_type, item_name, period, note):
    with connect() as c:
        cur = c.execute(
            "INSERT INTO requests(user_id,username,item_type,item_name,period,note,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (user_id, username, item_type, item_name, period, note, "new",
             datetime.now(timezone.utc).isoformat())
        )
        c.commit()
        return cur.lastrowid

def get_request(rid):
    with connect() as c:
        return c.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()

def list_requests(status=None, limit=25):
    with connect() as c:
        if status:
            return c.execute("SELECT * FROM requests WHERE status=? ORDER BY id DESC LIMIT ?", (status, limit)).fetchall()
        return c.execute("SELECT * FROM requests ORDER BY id DESC LIMIT ?", (limit,)).fetchall()

def set_status(rid, status):
    with connect() as c:
        cur = c.execute("UPDATE requests SET status=? WHERE id=?", (status, rid))
        c.commit()
        return cur.rowcount > 0

def user_requests(user_id, limit=10):
    with connect() as c:
        return c.execute("SELECT * FROM requests WHERE user_id=? ORDER BY id DESC LIMIT ?", (user_id, limit)).fetchall()
