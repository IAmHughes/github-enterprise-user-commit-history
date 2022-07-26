#!/bin/bash

if [ -f .env ]
then
  export $(cat .env | grep "^[^#;]" | xargs) >/dev/null
fi

for user in "$@"
do
  node user-commit-history-report.js --user $user
done

awk '(NR == 1) || (FNR > 1)' ${OUTPUT_FOLDER}/*.csv > report.csv
rm ${OUTPUT_FOLDER}/*.csv
