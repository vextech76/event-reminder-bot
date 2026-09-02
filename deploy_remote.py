"""Deploy event-reminder-bot to the home server via SSH/SFTP. Does not run the bot locally."""
from __future__ import annotations

import time
from pathlib import Path

import paramiko

HOST = "192.168.0.252"
USER = "vincent"
REMOTE_DIR = "event-reminder-bot"
LOCAL = Path(__file__).resolve().parent

SKIP_DIRS = {"node_modules", ".git", "data", "__pycache__", ".grok"}
SKIP_FILES = {"deploy_remote.py"}


def should_skip(rel: Path) -> bool:
    if any(part in SKIP_DIRS for part in rel.parts):
        return True
    if rel.name in SKIP_FILES:
        return True
    if rel.suffix == ".log":
        return True
    return False


def main() -> None:
    env_path = LOCAL / ".env"
    if not env_path.is_file():
        raise SystemExit("Missing local .env — create it before deploy.")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.load_system_host_keys()
    try:
        client.connect(HOST, username=USER, timeout=20, allow_agent=True, look_for_keys=True)
    except Exception:
        # Fall back to password only if key auth fails (same host as other bots)
        import getpass

        password = getpass.getpass(f"Password for {USER}@{HOST}: ")
        client.connect(HOST, username=USER, password=password, timeout=20)

    print(f"Connected to {USER}@{HOST}")

    def run(cmd: str, timeout: int = 120) -> tuple[int, str, str]:
        print(f"$ {cmd}")
        _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print(err.rstrip())
        print(f"[exit {code}]")
        return code, out, err

    _, home_out, _ = run("echo $HOME")
    home = home_out.strip() or f"/home/{USER}"
    remote_root = f"{home}/{REMOTE_DIR}"
    print(f"Remote root: {remote_root}")

    run(f"mkdir -p {remote_root}/data && chmod 700 {remote_root}")

    sftp = client.open_sftp()

    def ensure_remote_dir(remote_path: str) -> None:
        remote_path = remote_path.replace("\\", "/").rstrip("/")
        if not remote_path:
            return
        is_abs = remote_path.startswith("/")
        parts = [p for p in remote_path.split("/") if p]
        cur = ""
        for p in parts:
            cur = f"{cur}/{p}" if cur else (f"/{p}" if is_abs else p)
            try:
                sftp.stat(cur)
            except FileNotFoundError:
                try:
                    sftp.mkdir(cur)
                except OSError as e:
                    print(f"mkdir warn {cur}: {e}")

    uploaded = 0
    for path in LOCAL.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(LOCAL)
        if should_skip(rel):
            continue
        # Upload .env deliberately (local secrets → remote only; not committed)
        remote_path = f"{remote_root}/{rel.as_posix()}"
        parent = "/".join(remote_path.split("/")[:-1])
        ensure_remote_dir(parent)
        print(f"Upload {rel.as_posix()}")
        sftp.put(str(path), remote_path)
        uploaded += 1
        if rel.name == ".env":
            sftp.chmod(remote_path, 0o600)

    sftp.close()
    print(f"Uploaded {uploaded} file(s)")

    run("docker --version; docker compose version")
    code, _out, _err = run(
        f"cd {remote_root} && mkdir -p data && docker compose up -d --build",
        timeout=360,
    )
    if code != 0:
        client.close()
        raise SystemExit(f"docker compose failed with exit {code}")

    time.sleep(3)
    run(f"cd {remote_root} && docker compose ps")
    run(f"cd {remote_root} && docker compose logs --tail=40")

    # Register slash commands from inside the container (uses remote .env)
    code, _out, _err = run(
        f"cd {remote_root} && docker compose exec -T event-reminder-bot node src/register-commands.js",
        timeout=60,
    )
    if code != 0:
        print("WARN: slash command registration failed — check logs / CLIENT_ID")
    else:
        print("Slash commands registered.")

    run(f"cd {remote_root} && docker compose logs --tail=20")
    client.close()
    print("Deploy complete (bot runs on home server only).")


if __name__ == "__main__":
    main()
