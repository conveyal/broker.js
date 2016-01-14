/* @flow */
/**
 * The main entry point for the broker.
 */

import express from 'express'
import Multimap from 'multimap'
import bodyParser from 'body-parser'

import config from './config'
import Job from './job'
import status from './status'
import JobQueue from './job-queue'

// print the time so that the first line of the logfile is unique so AWS/Cloudwatch can keep track of log rotation
console.log(`Starting analyst broker at ${new Date()}`)

let queue = new JobQueue()

let app = express()
app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('Echo answers "whatever"')
})

/**
 * Create a job from JSON like this:
 * { id: 'U-U-I-D', name: 'Human readable name, if applicable', size: 10942, transportNetworkId: 'U-U-I-D'}
 */
app.put('/:jobId', (req, res) => {
  if (req.body.id !== req.params.jobId) {
    req.status(status.BAD_REQUEST)
  }

  let job = new Job(req.body)

  queue.enqueue(job)

  console.log(queue.getStatus())
})

app.listen(config.port, () => {
  console.log(`listening at port ${config.port}`)
})
