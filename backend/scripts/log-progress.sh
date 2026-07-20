#!/bin/bash
DATE=$(date +"%Y-%m-%d")
echo "## [$DATE]" >> docs/PROGRESS_LOG.md
echo "- $1" >> docs/PROGRESS_LOG.md
echo "" >> docs/PROGRESS_LOG.md
git add docs/PROGRESS_LOG.md
git commit -m "Update progress log: $1"
echo "Logged: $1"