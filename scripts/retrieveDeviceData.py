#!/usr/bin/env python3
"""
Retrieve TagoIO device data and export to Excel.

Usage:
  python retrieveDeviceData.py --token <TOKEN> --field <NAME> \
      [--variables rain_height air_temperature ...] \
      [--start 2025-01-01] [--end 2025-03-27] \
      [--command raw|avg|sum|min|max|last_item] \
      [--period day|week|month]  \
      [--output ./device_data]

--period breaks the range into day/week/month buckets and stores one row
per variable per bucket. Without --period a single aggregate is returned.

Note: TagoIO limits aggregate queries to 1-month windows.
"""
import argparse
import os
from datetime import datetime, timedelta, timezone
from dateutil.relativedelta import relativedelta

import pandas as pd
import requests
from tagoio_sdk import Device

TAGO_API = "https://api.tago.io"


def parse_args():
    parser = argparse.ArgumentParser(description="Retrieve TagoIO device data to Excel")
    parser.add_argument("--token",      required=True, help="TagoIO device token")
    parser.add_argument("--field",      required=True, help="Field/device name (used in output filename)")
    parser.add_argument("--variables",  nargs="*",     help="Variables to fetch (default: all)")
    parser.add_argument("--start",      default=None,  help="Start date ISO8601, e.g. 2025-01-01 (default: 8 months ago)")
    parser.add_argument("--end",        default=None,  help="End date ISO8601, e.g. 2025-03-27 (default: now)")
    parser.add_argument("--command",    default="raw",
                        choices=["raw", "avg", "sum", "min", "max", "last_item"],
                        help="Query type (default: raw)")
    parser.add_argument("--period",     default=None,
                        choices=["day", "week", "month"],
                        help="Break results into per-day/week/month rows (aggregate commands only)")
    parser.add_argument("--output",     default="device_data", help="Output directory (default: device_data)")
    parser.add_argument("--chunk-days", type=int, default=2,
                        help="Chunk size in days for raw pagination (default: 2)")
    return parser.parse_args()


def to_tago_iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def period_intervals(start: datetime, end: datetime, period: str):
    """Yield (label, s, e) tuples for each period bucket."""
    s = start
    while s < end:
        if period == "day":
            e = min(s + timedelta(days=1), end)
            label = s.strftime("%Y-%m-%d")
        elif period == "week":
            e = min(s + timedelta(weeks=1), end)
            label = f"{s.strftime('%Y-%m-%d')} W{s.isocalendar()[1]}"
        else:  # month
            e = min(s + relativedelta(months=1), end)
            label = s.strftime("%Y-%m")
        yield label, s, e
        s = e


def monthly_intervals(start: datetime, end: datetime):
    s = start
    while s < end:
        e = min(s + relativedelta(months=1), end)
        yield s, e
        s = e


def raw_intervals(start: datetime, end: datetime, chunk_days: int):
    s = start
    while s < end:
        e = min(s + timedelta(days=chunk_days), end)
        yield s, e
        s = e


# ---------------------------------------------------------------------------
# TagoIO REST call (bypasses SDK which can't handle float aggregate responses)
# ---------------------------------------------------------------------------

def _tago_get(token: str, variables: list, s: datetime, e: datetime, command: str):
    params = {
        "query":      command,
        "start_date": to_tago_iso(s),
        "end_date":   to_tago_iso(e),
        "qty":        10000,
    }
    if variables:
        params_list = list(params.items())
        for v in variables:
            params_list.append(("variables[]", v))
        params = params_list

    resp = requests.get(f"{TAGO_API}/data", headers={"Device-Token": token},
                        params=params, timeout=30)
    resp.raise_for_status()
    body = resp.json()
    if not body.get("status"):
        raise RuntimeError(f"TagoIO error: {body.get('message')}")

    result = body.get("result", [])
    if isinstance(result, (int, float)):
        var_name = variables[0] if variables and len(variables) == 1 else ",".join(variables or ["?"])
        return [{"variable": var_name, "value": result}]
    return result


# ---------------------------------------------------------------------------
# Fetch helpers
# ---------------------------------------------------------------------------

def fetch_raw(token: str, variables: list, start_dt: datetime, end_dt: datetime, chunk_days: int) -> list:
    device = Device({"token": token})
    all_data = []
    query = {"qty": 10000}
    if variables:
        query["variables"] = variables
    for s, e in raw_intervals(start_dt, end_dt, chunk_days):
        query["start_date"] = to_tago_iso(s)
        query["end_date"]   = to_tago_iso(e)
        data = device.getData(query)
        print(f"  {s.date()} → {e.date()}: {len(data)} records")
        all_data.extend(data)
    return all_data


def _merge(chunks: list[list], command: str) -> list:
    """Merge monthly chunks into a single aggregate per variable."""
    by_var: dict = {}
    for chunk in chunks:
        for row in chunk:
            by_var.setdefault(row.get("variable"), []).append(row.get("value"))

    merged = []
    for var, values in by_var.items():
        nums = [v for v in values if isinstance(v, (int, float))]
        if not nums:
            continue
        if command == "sum":
            val = sum(nums)
        elif command == "avg":
            val = sum(nums) / len(nums)
        elif command == "min":
            val = min(nums)
        else:  # max
            val = max(nums)
        merged.append({"variable": var, "value": val})
    return merged


def fetch_aggregate_total(token: str, variables: list,
                          start_dt: datetime, end_dt: datetime, command: str) -> list:
    """Single aggregate value for the entire range (chunked monthly, then merged)."""
    if command == "last_item":
        data = _tago_get(token, variables, start_dt, end_dt, command)
        print(f"  last_item → {len(data)} records")
        return data

    chunks = []
    for s, e in monthly_intervals(start_dt, end_dt):
        data = _tago_get(token, variables, s, e, command)
        print(f"  {s.date()} → {e.date()} ({command}): {len(data)} records")
        chunks.append(data)

    merged = _merge(chunks, command)
    print(f"  Merged → {len(merged)} variables")
    return merged


def fetch_aggregate_by_period(token: str, variables: list,
                               start_dt: datetime, end_dt: datetime,
                               command: str, period: str) -> list:
    """
    One aggregate value per variable per period bucket.
    Each bucket may span > 1 month only for 'month' period with a wide range,
    but month buckets are always ≤1 month so no inner chunking needed.
    For day/week buckets the window is always < 1 month.
    """
    rows = []
    for label, s, e in period_intervals(start_dt, end_dt, period):
        data = _tago_get(token, variables, s, e, command)
        for rec in data:
            rows.append({
                "period":    label,
                "variable":  rec.get("variable"),
                "value":     rec.get("value"),
                "unit":      rec.get("unit"),
            })
        print(f"  {label}: {len(data)} records")
    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    now      = datetime.now(timezone.utc)
    end_dt   = datetime.fromisoformat(args.end).replace(tzinfo=timezone.utc)   if args.end   else now
    start_dt = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc) if args.start else now - timedelta(days=30 * 8)

    suffix = f"{args.command}_{args.period}" if args.period else args.command
    print(f"Device: {args.field} | {start_dt.date()} → {end_dt.date()} | {suffix}")

    if args.command == "raw":
        records = fetch_raw(args.token, args.variables, start_dt, end_dt, args.chunk_days)
        df = pd.DataFrame([
            {"variable": d.get("variable"), "value": d.get("value"),
             "unit": d.get("unit"), "time": d.get("time"), "serie": d.get("serie")}
            for d in records
        ])
    elif args.period:
        records = fetch_aggregate_by_period(
            args.token, args.variables, start_dt, end_dt, args.command, args.period)
        df = pd.DataFrame(records)
    else:
        records = fetch_aggregate_total(
            args.token, args.variables, start_dt, end_dt, args.command)
        df = pd.DataFrame([
            {"variable": d.get("variable"), "value": d.get("value"), "unit": d.get("unit")}
            for d in records
        ])

    print(f"Total rows: {len(df)}")
    if df.empty:
        print("No data found.")
        return

    os.makedirs(args.output, exist_ok=True)
    xlsx_path = os.path.join(args.output, f"{args.field}_{suffix}.xlsx")
    df.to_excel(xlsx_path, index=False)
    print(f"Saved: {xlsx_path}")


if __name__ == "__main__":
    main()
