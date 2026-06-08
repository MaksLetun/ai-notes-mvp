#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone


HOST = os.environ.get("AI_NOTES_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("AI_NOTES_API_PORT", "8091"))
DB_PATH = os.environ.get("AI_NOTES_DB", "/var/lib/ai-notes/sync.sqlite3")
MAX_BODY = 2 * 1024 * 1024


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def workspace_hash(workspace_key):
    cleaned = str(workspace_key or "").strip()
    if len(cleaned) < 6:
        raise ValueError("Sync code must be at least 6 characters.")
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def connect_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute(
        """
        create table if not exists workspaces (
            workspace_hash text primary key,
            state_json text not null,
            created_at text not null,
            updated_at text not null
        )
        """
    )
    return connection


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class SyncHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_OPTIONS(self):
        json_response(self, 204, {})

    def do_GET(self):
        if self.path == "/api/health":
            json_response(self, 200, {"ok": True, "service": "ai-notes-sync", "time": utc_now()})
            return
        json_response(self, 404, {"ok": False, "error": "Not found."})

    def do_POST(self):
        try:
            payload = self.read_json()
            if self.path == "/api/sync/pull":
                self.handle_pull(payload)
                return
            if self.path == "/api/sync/push":
                self.handle_push(payload)
                return
            json_response(self, 404, {"ok": False, "error": "Not found."})
        except ValueError as error:
            json_response(self, 400, {"ok": False, "error": str(error)})
        except Exception:
            json_response(self, 500, {"ok": False, "error": "Internal sync error."})

    def read_json(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length > MAX_BODY:
            raise ValueError("Request is too large.")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON body.")

    def handle_pull(self, payload):
        key_hash = workspace_hash(payload.get("workspaceKey"))
        with connect_db() as connection:
            row = connection.execute(
                "select state_json, updated_at from workspaces where workspace_hash = ?",
                (key_hash,),
            ).fetchone()
        if not row:
            json_response(self, 200, {"ok": True, "exists": False, "state": None, "updatedAt": None})
            return
        json_response(self, 200, {"ok": True, "exists": True, "state": json.loads(row[0]), "updatedAt": row[1]})

    def handle_push(self, payload):
        key_hash = workspace_hash(payload.get("workspaceKey"))
        state = payload.get("state")
        if not isinstance(state, dict):
            raise ValueError("State must be an object.")
        state_json = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
        now = utc_now()
        with connect_db() as connection:
            connection.execute(
                """
                insert into workspaces (workspace_hash, state_json, created_at, updated_at)
                values (?, ?, ?, ?)
                on conflict(workspace_hash) do update set
                    state_json = excluded.state_json,
                    updated_at = excluded.updated_at
                """,
                (key_hash, state_json, now, now),
            )
        json_response(self, 200, {"ok": True, "updatedAt": now})


def main():
    connect_db().close()
    server = ThreadingHTTPServer((HOST, PORT), SyncHandler)
    print(f"ai-notes-sync listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
