#!/bin/bash

for user in "$@"
do
  node user-commit-history-report.js --user $user
done

awk '(NR == 1) || (FNR > 1)' /tmp/commit-history/*.csv > report.csv
rm /tmp/commit-history/*.csv

