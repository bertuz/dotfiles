#!/usr/bin/env python3
"""Security guard for Claude Code PreToolUse hook.

Reads the tool invocation as JSON on stdin and decides whether to allow it.

Blocks:
  * Bash tool calls that:
      - run `export`, `printenv`, bare `env`, or bare `set` (env-var leaks)
      - reference a path that looks like a private key (filename pattern,
        path inside .ssh/, or content begins with `-----BEGIN ... PRIVATE KEY-----`)
  * Read / Edit / Write tool calls that target a private-key path.

Exit codes:
  0 -> allow
  2 -> block (stderr is shown to the model)
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

PRIVATE_KEY_FILENAME_PATTERNS = [
    re.compile(r"^id_(rsa|dsa|ecdsa|ed25519|ed448|xmss)$", re.IGNORECASE),
    re.compile(r".*_(rsa|dsa|ecdsa|ed25519)$", re.IGNORECASE),
    re.compile(r"\.pem$", re.IGNORECASE),
    re.compile(r"\.key$", re.IGNORECASE),
    re.compile(r"\.p8$", re.IGNORECASE),
    re.compile(r"\.pkcs8$", re.IGNORECASE),
    re.compile(r"\.pkcs12$", re.IGNORECASE),
    re.compile(r"\.pfx$", re.IGNORECASE),
    re.compile(r"\.p12$", re.IGNORECASE),
    re.compile(r"\.jks$", re.IGNORECASE),
    re.compile(r"\.keystore$", re.IGNORECASE),
]

SAFE_SSH_FILENAMES = {
    "config",
    "known_hosts",
    "known_hosts.old",
    "authorized_keys",
}

PRIVATE_KEY_HEADER_RE = re.compile(rb"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----")

ENV_LEAK_FIRST_TOKENS_ALWAYS = {"export", "printenv"}
ENV_LEAK_FIRST_TOKENS_BARE_ONLY = {"env", "set"}

COMMAND_SEPARATOR_RE = re.compile(r"(?:&&|\|\||;|\n|\||&)")
PATH_TOKEN_SPLIT_RE = re.compile(r"[\s;&|\"'`<>()]+")


def expand_home(path: str) -> str:
    if path == "~":
        return os.environ.get("HOME", path)
    if path.startswith("~/"):
        home = os.environ.get("HOME", "")
        return f"{home}/{path[2:]}"
    return path


def is_public_key_file(name: str) -> bool:
    return name.lower().endswith(".pub")


def is_inside_ssh_dir(path: str) -> bool:
    return bool(re.search(r"(?:^|/)\.ssh/", path))


def filename_looks_like_private_key(name: str) -> bool:
    if is_public_key_file(name):
        return False
    return any(p.search(name) for p in PRIVATE_KEY_FILENAME_PATTERNS)


def sniff_file_looks_like_private_key(path: str) -> bool:
    try:
        st = os.stat(path)
        if not os.path.isfile(path) or st.st_size == 0:
            return False
        with open(path, "rb") as f:
            head = f.read(512)
        return bool(PRIVATE_KEY_HEADER_RE.search(head))
    except OSError:
        return False


def classify_path(path: str, cwd: str) -> tuple[bool, str | None]:
    if not path:
        return False, None

    expanded = expand_home(path)
    absolute = expanded if os.path.isabs(expanded) else str(Path(cwd) / expanded)
    name = os.path.basename(absolute)

    if is_public_key_file(name):
        return False, None

    if is_inside_ssh_dir(absolute) and name not in SAFE_SSH_FILENAMES:
        return True, f"path inside .ssh directory: {absolute}"

    if filename_looks_like_private_key(name):
        return True, f"filename matches private-key pattern: {absolute}"

    if os.path.exists(absolute) and sniff_file_looks_like_private_key(absolute):
        return True, f"file content begins with a PRIVATE KEY header: {absolute}"

    return False, None


def is_env_command_blocked(command: str) -> tuple[bool, str | None]:
    segments = COMMAND_SEPARATOR_RE.split(command)
    for segment in segments:
        trimmed = segment.strip()
        if not trimmed:
            continue
        tokens = trimmed.split()
        first = tokens[0]
        if first in ENV_LEAK_FIRST_TOKENS_ALWAYS:
            return True, first
        if first in ENV_LEAK_FIRST_TOKENS_BARE_ONLY and len(tokens) == 1:
            return True, first
    return False, None


def extract_path_like_tokens(command: str) -> list[str]:
    raw = PATH_TOKEN_SPLIT_RE.split(command)
    out = []
    for tok in raw:
        if not tok:
            continue
        tok = tok.lstrip("=")
        if not tok or tok.startswith("-"):
            continue
        if "/" in tok or tok.startswith("~") or tok.startswith("."):
            out.append(tok)
            continue
        if any(p.search(tok) for p in PRIVATE_KEY_FILENAME_PATTERNS):
            out.append(tok)
    return out


def is_bash_command_blocked(command: str, cwd: str) -> tuple[bool, str | None]:
    blocked, match = is_env_command_blocked(command)
    if blocked:
        return True, f"'{match}' command is not allowed (would leak environment variables)"

    for token in extract_path_like_tokens(command):
        b, reason = classify_path(token, cwd)
        if b:
            return True, f"command references a private key ({reason})"

    return False, None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or os.getcwd()

    if tool_name == "Bash":
        command = tool_input.get("command", "") or ""
        blocked, reason = is_bash_command_blocked(command, cwd)
        if blocked:
            sys.stderr.write(
                f"Blocked by security-guard hook: {reason}. Command: {command}\n"
            )
            return 2
        return 0

    if tool_name in {"Read", "Edit", "Write", "MultiEdit"}:
        file_path = tool_input.get("file_path", "") or tool_input.get("filePath", "") or ""
        blocked, reason = classify_path(file_path, cwd)
        if blocked:
            sys.stderr.write(f"Blocked by security-guard hook: {reason}\n")
            return 2
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
