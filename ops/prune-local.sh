#!/bin/sh
set -eu
count=0
for stamp in $(ls -1 /backups | sort -r); do
  case "$stamp" in
    ????????T??????Z)
      [ -f "/backups/$stamp/SHA256SUMS" ] || continue
      count=$((count + 1))
      [ "$count" -le 7 ] || rm -rf "/backups/$stamp"
      ;;
  esac
done
