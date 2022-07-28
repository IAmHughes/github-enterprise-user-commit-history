require('dotenv').config()
const argv = require('yargs').argv
const fs = require('fs')
let { graphql } = require('@octokit/graphql')
graphql = graphql.defaults({
  baseUrl: process.env.GITHUB_ENDPOINT,
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`
  }
})
const outputBaseFolder = process.env.OUTPUT_FOLDER

// Full path and name of output file to create
const outputFile = `${outputBaseFolder}/user-${argv.user}-commit-history-report-${Date.now()}.csv`

async function runGraphQL() {
  await getUserAuthorID()
  getUserCommitHistory()
}

let authorID = null
if (argv.user.length > 0) {
  createCSV()
  runGraphQL()
} else {
  console.log('Invalid options passed\n')
  console.log('To use this script, you must specify a user: ')
  console.log('node user-commit-history-report.js --user <username>\n')
}

async function getUserAuthorID () {
  const query =
    `query ($user: String!) {
      user(login:$user) {
        id
      }
    }`
  try {
    let getUserAuthorIDResult = null
    getUserAuthorIDResult = await graphql({
      query,
      user: argv.user
    })

    authorID = getUserAuthorIDResult.user.id
  } catch (error) {
    console.log('Request failed:', error.request)
    console.log(error.message)
    console.log(error)
  }
}

async function getUserCommitHistory () {
  let paginationRepo = null
  let paginationCommit = null
  const query =
    `query ($user: String!, $cursorRepo: String) {
      user(login: $user) {
        repositoriesContributedTo(
          includeUserRepositories: true
          contributionTypes: COMMIT
          first: 100
          after: $cursorRepo
        ) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            owner {
              login
            }
            name
          }
        }
      }
    }`

  const commitQuery =
      `query ($authorID: ID, $ownerName: String!, $repoName: String!, $startDate: GitTimestamp, $cursorCommit: String) {
    repository(owner: $ownerName, name: $repoName) {
      defaultBranchRef {
        name
        target {
        ... on Commit {
            history(
                first: 100
            after: $cursorCommit
            since: $startDate
            author: { id: $authorID }
          ){
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
              ... on Commit {
                  committedDate
                  oid
                  message
                  additions
                  deletions
                  changedFiles
                  commitUrl
                  treeUrl
                }
              }
            }
          }
        }
      }
    }
  }`

  try {
    let hasNextPageRepo = false
    let hasNextPageCommit = false
    let getUserCommitHistoryResult = null
    let getUserCommitRepoHistoryResult = null
    do {
        getUserCommitRepoHistoryResult = await graphql({
          query,
          user: argv.user,
          cursorRepo: paginationRepo
        })
        const repositoriesContributedTo = getUserCommitRepoHistoryResult.user.repositoriesContributedTo
        const repositoriesContributedToPageInfo = repositoriesContributedTo.pageInfo
        hasNextPageRepo = repositoriesContributedToPageInfo.hasNextPage
        const reposObj = repositoriesContributedTo.nodes
        let repoNode = 0

        for (const repo of reposObj) {
          if (repo == null) { continue; }
          do {
            getUserCommitHistoryResult = await graphql({
              query: commitQuery,
              authorID: authorID,
              ownerName: repo.owner.login,
              repoName: repo.name,
              startDate: process.env.START_DATE,
              cursorCommit: paginationCommit
            })

            if (getUserCommitHistoryResult.repository.defaultBranchRef != null) {
              const repoHistory = getUserCommitHistoryResult.repository.defaultBranchRef.target.history
              const repoHistoryPageInfo = repoHistory.pageInfo
              const commitsObj = repoHistory.nodes
              hasNextPageCommit = repoHistoryPageInfo.hasNextPage
              if (Object.keys(commitsObj).length > 0) {
                for (const commit of commitsObj) {
                  addToCSV(argv.user, repo.owner.login, repo.name, commit.committedDate, commit.oid, JSON.stringify(commit.message), commit.changedFiles, commit.commitUrl)
                }

                if (hasNextPageCommit) {
                  paginationCommit = repoHistoryPageInfo.endCursor
                } else {
                  paginationCommit = null
                }
              }
              repoNode++
            }
          } while (hasNextPageCommit)
        }
      if (hasNextPageRepo) {
        paginationRepo = repositoriesContributedToPageInfo.endCursor
      }
    } while (hasNextPageRepo)
  } catch (error) {
    console.log('Request failed:', error.request)
    console.log(error.message)
    console.log(error)
  }
}

function createCSV () {
  if (!fs.existsSync(outputBaseFolder)) {
    fs.mkdirSync(outputBaseFolder)
  }
  const header = 'User,Organization,Repository,Date,CommitSha,CommitMessage,NumFilesChanged,DiffURL'
  fs.appendFileSync(outputFile, header + '\n', err => {
    if (err) return console.log(err)
  })
}

function addToCSV (user, org, repo, date, commitSha, commitMessage, numFilesChanged, diffUrl) {
  fs.appendFileSync(outputFile, `${user},${org},${repo},${date},${commitSha},${commitMessage},${numFilesChanged},${diffUrl}\n`)
}
