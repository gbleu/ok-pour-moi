#!/bin/bash
set -e

cd "$(dirname "$0")"

bun src

osascript -e 'tell application "Terminal" to close front window' &
