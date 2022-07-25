# User commit history report for GitHub Enterprise

This Node script can be used on GitHub Enterprise (Server or Cloud) to get a specific user's commit history to the default branch for all repositories the user has committed to. It will return a `.csv` file of the report, including both user and organization-owned repositories. It **requires** a GitHub Personal Access Token with the following scopes on a user or service account that is an **organization owner** for every organization in the Enterprise:
  - `admin:enterprise`
  - `admin:org`
  - `admin:repo`

## How to run
- Install the node modules
  - `npm install`
- Create `.env` with needed variables based on `.env.example`
  - The `OUTPUT_FOLDER` specified will be created if needed, and the generated `.csv` will be within
- Run the script and pass the username via the `--user` flag
  - `node user-commit-history-report.js --user <someUserHandle>`

## Report layout
Once the script has run to completion, you will be presented with a report in the format below:

`Filename: user-<username>-commit-history-report-<epoch_timestamp>.csv`

```csv
Organization,Repository,Date,CommitSha,NumFilesChanged,DiffURL
org1,repo1,2022-07-25T09:30:21Z,0884ba29abcdefghijklmnopqrst12345,3,https://<url>
org1,repo2,2022-07-22T13:27:00Z,0884ba29abcdefghijklmnopqrst67890,13,https://<url>
org2,repo1,2022-07-19T06:23:37Z,0884ba29abcdefghijklmnopqrst13579,24,https://<url>
org2,repo2,2022-07-19T06:15:01Z,0884ba29abcdefghijklmnopqrst246810,1,https://<url>
...
```

## Caveats
This script requires that the `GITHUB_TOKEN` provided have the scopes listed above, and the user creating the token needs to be an organization owner of **every** organization in the Enterprise to get a complete report.
  - If the user creating the `GITHUB_TOKEN` does not have `organization owner` access to a specific organization, the end report will not include that organization

The script only returns commits made to the default branch of a repository (i.e. `main` or `master`, any commits made to other branches on the repository will not be reflected unless they were merged into the default branch).
