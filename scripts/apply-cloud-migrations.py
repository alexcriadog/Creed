#!/usr/bin/env python3
"""
Apply Supabase migrations to Cloud project via Management API.

Splits each migration file into statements (respecting $$ dollar-quoted bodies)
and POSTs each statement separately so errors are visible per-statement.

Usage:
  SUPABASE_PAT=sbp_... PROJECT_REF=hlgqxingeavdltgzzbvy \
    python3 scripts/apply-cloud-migrations.py [--from-file FILENAME]
"""

import argparse
import glob
import json
import os
import sys
import urllib.request
import urllib.error


def split_statements(sql: str) -> list[str]:
    stmts: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    in_dollar = False
    in_line_comment = False
    in_block_comment = False
    in_single_quote = False
    while i < n:
        c = sql[i]
        c2 = sql[i:i + 2]
        if in_line_comment:
            buf.append(c)
            if c == '\n':
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            buf.append(c)
            if c2 == '*/':
                buf.append(sql[i + 1])
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if not in_dollar and not in_single_quote and c2 == '--':
            in_line_comment = True
            buf.append(c2)
            i += 2
            continue
        if not in_dollar and not in_single_quote and c2 == '/*':
            in_block_comment = True
            buf.append(c2)
            i += 2
            continue
        if not in_single_quote and c2 == '$$':
            in_dollar = not in_dollar
            buf.append(c2)
            i += 2
            continue
        if not in_dollar and c == "'":
            in_single_quote = not in_single_quote
            buf.append(c)
            i += 1
            continue
        if not in_dollar and not in_single_quote and c == ';':
            stmt = ''.join(buf).strip()
            if stmt:
                stmts.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    tail = ''.join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts


def post_query(endpoint: str, pat: str, query: str) -> tuple[int, str]:
    payload = json.dumps({'query': query}).encode('utf-8')
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8') if e.fp else str(e)
    except Exception as e:
        return 0, f'request_failed: {e}'


def short(stmt: str, n: int = 90) -> str:
    cleaned = ' '.join(stmt.split())
    return cleaned[:n] + ('…' if len(cleaned) > n else '')


def apply_file(endpoint: str, pat: str, filepath: str) -> bool:
    name = os.path.basename(filepath)
    print(f'\n=== {name} ===')
    with open(filepath) as f:
        sql = f.read()
    stmts = split_statements(sql)
    print(f'  statements: {len(stmts)}')
    all_ok = True
    for idx, stmt in enumerate(stmts, 1):
        status, body = post_query(endpoint, pat, stmt)
        is_error_body = body.startswith('{"message":') or body.startswith('{"error":')
        ok = (status == 200 or status == 201) and not is_error_body
        if ok:
            print(f'  [{idx:02d}/{len(stmts)}] OK   {short(stmt)}')
        else:
            all_ok = False
            print(f'  [{idx:02d}/{len(stmts)}] FAIL {short(stmt)}')
            print(f'      HTTP {status} → {body[:300]}')
    return all_ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-file')
    parser.add_argument('--migrations-dir', default='supabase/migrations')
    args = parser.parse_args()

    pat = os.environ.get('SUPABASE_PAT')
    project_ref = os.environ.get('PROJECT_REF', 'hlgqxingeavdltgzzbvy')
    if not pat:
        print('ERROR: SUPABASE_PAT env var required', file=sys.stderr)
        sys.exit(1)

    endpoint = f'https://api.supabase.com/v1/projects/{project_ref}/database/query'

    if args.from_file:
        files = [args.from_file]
    else:
        files = sorted(glob.glob(os.path.join(args.migrations_dir, '*.sql')))

    if not files:
        print(f'No migrations found', file=sys.stderr)
        sys.exit(1)

    overall_ok = True
    for f in files:
        ok = apply_file(endpoint, pat, f)
        if not ok:
            overall_ok = False
            print(f'  ✗ {os.path.basename(f)} had failures')
        else:
            print(f'  ✓ {os.path.basename(f)} fully applied')

    print()
    if overall_ok:
        print('ALL MIGRATIONS APPLIED OK')
    else:
        print('SOME STATEMENTS FAILED — check output above')
        sys.exit(1)


if __name__ == '__main__':
    main()
