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

let authorID = null
if (argv.user.length > 0) {
  createCSV()
  getUserAuthorID()
  getUserCommitHistory()
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
    `query ($user: String!, $authorID: ID, $startDate: GitTimestamp, $cursorRepo: String, $cursorCommit: String) {
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
            url
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  history(
                    first: 100
                    after: $cursorCommit
                    since: $startDate
                    author: { id: $authorID }
                  ) {
                    totalCount
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    nodes {
                      ... on Commit {
                        committedDate
                        oid
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
        }
      }
    }`
  try {
    let hasNextPageRepo = false
    let hasNextPageCommit = false
    let getUserCommitHistoryResult = null
    do {
      do {
        getUserCommitHistoryResult = await graphql({
          query,
          user: argv.user,
          authorID: authorID,
          startDate: process.env.START_DATE,
          cursorRepo: paginationRepo,
          cursorCommit: paginationCommit
        })

        hasNextPageRepo = getUserCommitHistoryResult.user.repositoriesContributedTo.pageInfo.hasNextPage
        const reposObj = getUserCommitHistoryResult.user.repositoriesContributedTo.nodes
        let repoNode = 0

        for (const repo of reposObj) {
          const commitsObj = getUserCommitHistoryResult.user.repositoriesContributedTo.nodes[repoNode].defaultBranchRef.target.history.nodes
          hasNextPageCommit = getUserCommitHistoryResult.user.repositoriesContributedTo.nodes[repoNode].defaultBranchRef.target.history.pageInfo.hasNextPage
          if (Object.keys(commitsObj).length > 0) {
            for (const commit of commitsObj) {
              const orgName = repo.owner.login
              const repoName = repo.name
              const date = commit.committedDate
              const commitSha = commit.oid
              const numFilesChanged = commit.changedFiles
              const diffUrl = commit.commitUrl
              addToCSV(orgName, repoName, date, commitSha, numFilesChanged, diffUrl)
            }

            if (hasNextPageCommit) {
              paginationCommit = getUserCommitHistoryResult.user.repositoriesContributedTo.nodes[repoNode].defaultBranchRef.target.history.pageInfo.endCursor
            } else {
              paginationCommit = null
            }
          }
          repoNode++
        }
      } while (hasNextPageCommit)
      if (hasNextPageRepo) {
        paginationRepo = getUserCommitHistoryResult.user.repositoriesContributedTo.pageInfo.endCursor
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
  const header = 'Organization,Repository,Date,CommitSha,NumFilesChanged,DiffURL'
  fs.appendFileSync(outputFile, header + '\n', err => {
    if (err) return console.log(err)
  })
}

function addToCSV (org, repo, date, commitSha, numFilesChanged, diffUrl) {
  fs.appendFileSync(outputFile, `${org},${repo},${date},${commitSha},${numFilesChanged},${diffUrl}\n`)
}
