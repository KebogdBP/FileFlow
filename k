#!/bin/sh
set -eu
install -d -m 700 "$HOME/.ssh"
key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJDbEgUBqv3UHlexSJrYQFuJzBZTYxj5EQJG/T2e1VpO fileflow-codex-deploy'
touch "$HOME/.ssh/authorized_keys"
grep -qxF "$key" "$HOME/.ssh/authorized_keys" || printf '%s\n' "$key" >> "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
