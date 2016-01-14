/* @flow */
/**
 * The main entry point for the broker.
 */

import express from 'express'
import Multimap from 'multimap'

import Job from './job'
import status from './status'

// print the time so that the first line of the logfile is unique so AWS/Cloudwatch can keep track of log rotation
console.log(`Starting analyst broker at ${new Date()}`)

const PORT = 9009

let app = express()

app.get('/', (req, res) => {
  res.send('Echo answers "whatever"')
})

/**
 * Create a job from JSON like this:
 * { id: 'U-U-I-D', name: 'Human readable name, if applicable', size: 10942, transportNetworkId: 'U-U-I-D'}
 */
app.put('/:jobId', (req, res) => {
  // parse request as JSON
  let jobObj = JSON.parse(req.body)

  if (jobObj.id !== req.params.jobId) {
    req.status(status.BAD_REQUEST)
  }

  let job = new Job(jobObj)
})

app.listen(PORT, () => {
  console.log(`listening at port ${PORT}`)
})
