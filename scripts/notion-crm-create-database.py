#!/usr/bin/env python3
"""
Crée la base Notion « Suppliers Pipeline » sous une page parente.

Usage:
  export NOTION_API_KEY=secret_...
  export NOTION_PARENT_PAGE_ID=...   # page où créer la DB
  python scripts/notion-crm-create-database.py

Requires: pip install requests
"""

from __future__ import annotations

import os
import sys

try:
    import requests
except ImportError:
    print("Install: pip install requests", file=sys.stderr)
    sys.exit(1)

NOTION_VERSION = "2022-06-28"

STATUS_OPTIONS = [
    {"name": "Lead", "color": "gray"},
    {"name": "Contacted", "color": "blue"},
    {"name": "Call Booké", "color": "purple"},
    {"name": "Négociation", "color": "yellow"},
    {"name": "Onboarded", "color": "green"},
    {"name": "Actif", "color": "green"},
    {"name": "Lost", "color": "red"},
]


def main() -> int:
    token = os.environ.get("NOTION_API_KEY", "").strip()
    parent_id = os.environ.get("NOTION_PARENT_PAGE_ID", "").strip()
    if not token or not parent_id:
        print("Set NOTION_API_KEY and NOTION_PARENT_PAGE_ID", file=sys.stderr)
        return 1

    payload = {
        "parent": {"type": "page_id", "page_id": parent_id},
        "title": [{"type": "text", "text": {"content": "Suppliers Pipeline"}}],
        "properties": {
            "Name": {"title": {}},
            "URL site": {"url": {}},
            "SIRET": {"rich_text": {}},
            "Catégorie": {"select": {"options": []}},
            "Telegram @": {"rich_text": {}},
            "Status": {"select": {"options": STATUS_OPTIONS}},
            "Dernier contact": {"date": {}},
            "Notes": {"rich_text": {}},
        },
    }

    res = requests.post(
        "https://api.notion.com/v1/databases",
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )

    if res.status_code >= 400:
        print(f"Notion error {res.status_code}: {res.text}", file=sys.stderr)
        return 1

    data = res.json()
    db_id = data.get("id", "")
    print(f"[crm-create-db] ok database_id={db_id}")
    print("Add to .env.local: NOTION_CRM_DATABASE_ID=" + db_id)
    print("Then in Notion UI: add Board view grouped by Status, Table view filter Lead|Contacted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
