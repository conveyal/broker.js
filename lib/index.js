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

// log the queue status
function log () {
  console.log(queue.getStatus())
}

app.get('/', (req, res) => {
  // send verbose status
  res.type('text/plain').send(queue.getStatus(true))
})

app.get('/:jobId', (req, res) => {
  res.send(queue.jobs.get(req.params.jobId))
})

/**
 * Create a job from JSON like this:
 * { id: 'U-U-I-D', name: 'Human readable name, if applicable', size: 10942, transportNetworkId: 'U-U-I-D'}
 */
app.put('/:jobId', (req, res) => {
  if (req.body.id !== req.params.jobId) {
    res.status(status.BAD_REQUEST)
    res.send('Job ID must equal ID specified in URL')
    return
  }

  let job = new Job(req.body)

  queue.enqueue(job)

  log()

  res.send(job)
})

/** Request to dequeue low priority work */
app.post('/dequeue', (req, res) => {
  let { transportNetworkIds, max } = req.body
  console.log(`dequeuing up to ${max} requests on preferred transport network ids ${transportNetworkIds}`)

  let jobs = queue.getJobs(transportNetworkIds, max)

  // TODO log pollution
  if (jobs.tasks.length === 0) console.log('Found no jobs to send to worker')

  res.send(jobs)

  log()
})

app.delete('/:jobId/:taskId', (req, res) => {
  queue.complete(req.params.jobId, Number(req.params.taskId))
  res.send('ok')
})

app.delete('/:jobId', (req, res) => {

})

app.listen(config.port, () => {
  console.log(`listening at port ${config.port}`)
})
