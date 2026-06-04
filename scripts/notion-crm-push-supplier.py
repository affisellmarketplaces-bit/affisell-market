#!/usr/bin/env python3
"""
Push un fournisseur dans la base Notion « Suppliers Pipeline ».

Usage:
  export NOTION_API_KEY=secret_...
  export NOTION_CRM_DATABASE_ID=...
  python scripts/notion-crm-push-supplier.py --name "Acme" --status Lead

Requires: pip install requests
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

try:
    import requests
except ImportError:
    print("Install: pip install requests", file=sys.stderr)
    sys.exit(1)

NOTION_VERSION = "2022-06-28"
VALID_STATUSES = {
    "Lead",
    "Contacted",
    "Call Booké",
    "Négociation",
    "Onboarded",
    "Actif",
    "Lost",
}


def build_properties(args: argparse.Namespace) -> dict[str, Any]:
    props: dict[str, Any] = {
        "Name": {"title": [{"text": {"content": args.name}}]},
        "Status": {"select": {"name": args.status}},
    }
    if args.url:
        props["URL site"] = {"url": args.url}
    if args.siret:
        props["SIRET"] = {"rich_text": [{"text": {"content": args.siret}}]}
    if args.categorie:
        props["Catégorie"] = {"select": {"name": args.categorie}}
    if args.telegram:
        props["Telegram @"] = {"rich_text": [{"text": {"content": args.telegram}}]}
    if args.notes:
        props["Notes"] = {"rich_text": [{"text": {"content": args.notes}}]}
    if args.dernier_contact:
        props["Dernier contact"] = {"date": {"start": args.dernier_contact}}
    return props


def main() -> int:
    parser = argparse.ArgumentParser(description="Push supplier lead to Notion CRM")
    parser.add_argument("--name", required=True, help="Supplier name (title)")
    parser.add_argument("--url", default=None, help="Website URL")
    parser.add_argument("--siret", default=None, help="SIRET")
    parser.add_argument("--categorie", default=None, help="Category select value")
    parser.add_argument("--telegram", default=None, help="Telegram handle")
    parser.add_argument(
        "--status",
        default="Lead",
        choices=sorted(VALID_STATUSES),
        help="Pipeline status",
    )
    parser.add_argument("--notes", default=None, help="Free text notes")
    parser.add_argument(
        "--dernier-contact",
        dest="dernier_contact",
        default=None,
        help="ISO date YYYY-MM-DD",
    )
    args = parser.parse_args()

    token = os.environ.get("NOTION_API_KEY", "").strip()
    database_id = os.environ.get("NOTION_CRM_DATABASE_ID", "").strip()
    if not token or not database_id:
        print("Set NOTION_API_KEY and NOTION_CRM_DATABASE_ID", file=sys.stderr)
        return 1

    payload = {
        "parent": {"database_id": database_id},
        "properties": build_properties(args),
    }

    res = requests.post(
        "https://api.notion.com/v1/pages",
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
    page_id = data.get("id", "")
    url = data.get("url", "")
    print(f"[crm-push] ok page_id={page_id} url={url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
