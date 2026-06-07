import sqlite3
import hashlib
import os

def hash(password):
    sha256 = hashlib.sha256()
    sha256.update(password.encode('utf-8'))
    return sha256.hexdigest()

conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), 'data.db'))

cursor = conn.cursor()
cursor.execute('''  CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    password TEXT)''')

cursor.execute('''  CREATE TABLE IF NOT EXISTS songs (
                    id TEXT,
                    class TEXT,
                    score REAL,
                    username TEXT,
                    play_count INTEGER DEFAULT 0,
                    last_updated TEXT,
                    PRIMARY KEY (id, class, username))''')

cursor.execute('''  CREATE TABLE IF NOT EXISTS custom (
                    username TEXT PRIMARY KEY,
                    avatar TEXT)''')

try:
    cursor.execute('''ALTER TABLE songs ADD COLUMN play_count INTEGER DEFAULT 0''')
except:
    pass
try:
    cursor.execute('''ALTER TABLE songs ADD COLUMN last_updated TEXT''')
except:
    pass

cursor.execute('''UPDATE songs SET play_count = 0 WHERE play_count IS NULL''')
cursor.execute('''UPDATE songs SET last_updated = '2026-06-01' WHERE last_updated IS NULL''')

cursor.execute('''INSERT INTO users (username, password) VALUES ('616', 'b831b33e0c05b45e15bbdd9b3bfa43825fee0aa0b6e5a54e31e2bd8b073b76b7')''')
conn.commit()
conn.close()