#!/bin/bash
set -e

cd "$(dirname "$0")"

bun src/index.ts

osascript -e 'tell application "Terminal" to close front window' &
