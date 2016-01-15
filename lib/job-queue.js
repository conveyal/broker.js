/* @flow */
/**
 * Handles queueing and disseminating jobs.
 * @author mattwigway
 *
 * The goal for this system is to make it as simple, self-organizing, and resilient as possible. Our previous broker
 * attempted to actively track the graph affinity of worker, rationally/fairly distribute tasks, and actively start
 * workers. We later realized that we don't need to have all of this logic, we can implement some simple stochastic rules
 * that for all intents and purposes perform just as well. The main things that enable us to do this are 1) r5 can load graphs
 * very rapidly, meaning that the improbable occasion when work is not distributed optimally will not cause a large pause for the
 * end user, and 2) because graph sizes are so much smaller, r5 can hold multiple graphs in memory simultaneously. One goal of this
 * system is to have the broker no longer directly start or stop machines, but simply to change the size of an AWS autoscaling group.
 *
 * The system we have devised is as follows. We have a list of all the jobs currently being processed. Each job receives a weight, which
 * is based upon how many jobs are currently being run by its user (each user has a weight which is evenly divided amongst jobs). This
 * means that the system tends towards distributing tasks fairly, even though there is no strong guarantee (the expectation of delivery
 * is fairness, but there may be some deviation.)
 *
 * We also respect graph affinity (i.e. we attempt to send tasks to workers which already have the appropriate graph loaded). Loading a graph
 * from disk is relatively fast, but takes on the order of the same amount of time as computing a single task once the graph is loaded. The way
 * this works is that when a worker requests work and specifies that it has certain graphs already loaded, jobs on those graphs are overweighted
 * in the random selection process stated above.
 *
 * Single point requests are special because we can't wait for the worker polling interval to complete them. We need to have persistent connections
 * from a worker to the broker, waiting to immediately receive single point work. We'd rather not have a single connection from
 * every single worker, as that won't be scalable when Conveyal takes over the world and has 100 million workers running, because there
 * will be too many HTTP connections/open file descriptors (sockets). Instead, the broker will keep a map of transport network IDs
 * with associated connections to a worker that can handle work on that graph.  If we receive single point work for a transport network that
 * isn't in that map, we handle the work through the normal polling method. We can't choose a side channel that's already open on a different
 * graph because that would lead to all single point work being handled by one machine.
 * After a worker receives a single point job, it opens a side channel to receive more single point work on the graphs it has in memory.
 */

import moment from 'moment'
import Multimap from 'multimap'
import Job from './job'

export default class JobQueue {
  jobsByNetwork: Multimap<string, Job>;
  jobsByUser: Multimap<string, Job>;
  jobs: Map<string, Job>;

  constructor () {
    this.jobsByNetwork = new Multimap()
    this.jobs = new Map()
    this.jobsByUser = new Multimap()
  }

  /** Get the number of tasks waiting in this queue. Used to scale the worker pool */
  // $FlowIssue getters not supported
  get tasksWaiting (): number {
    let total = 0

    for (let job of this.jobs.values()) {
      console.dir(job)
      total += job.size - job.nComplete
    }

    return total
  }

  /** Get jobs, giving additional weight to the specified graph IDs */
  getJobs(graphIds: Array<String> = [], max: number = 10): {
    jobId: ?string,
    tasks: Array<number>
  } {
    if (this.jobs.size === 0) {
      return {
        jobId: null,
        tasks: []
      }
    }

    let graphIdSet = new Set(graphIds)

    let weightsByJob: Map<string, number> = new Map()

    let totalWeight = 0
    let preferredJobs = []
    let nJobs = 0

    this.jobsByUser.forEachEntry((jobs, user) => {
      jobs = jobs.filter(j => !j.done)

      if (jobs.length === 0) return // don't divide by zero

      let weight = 1 / jobs.length
      jobs.forEach(j => {
        nJobs++
        weightsByJob.set(j.id, weight)
        if (graphIdSet.has(j.transportNetworkId)) preferredJobs.push(j)
      })

      totalWeight += 1
    })

    if (nJobs === 0) {
      return {
        jobId: null,
        tasks: []
      }
    }

    console.log(`found ${nJobs} incomplete jobs`)

    // assign as much weight as was assigned randomly to the preferred jobs
    // This means that 50% of the time we choose randomly (which may still mean choosing the preferred graph, but fairly)
    if (preferredJobs.length > 0) {
      let weightPerPreferredJob = totalWeight / preferredJobs.length
      preferredJobs.forEach(j => {
        weightsByJob.set(j.id, weightsByJob.get(j.id) + weightPerPreferredJob)
        totalWeight += weightPerPreferredJob
      })
    }

    let rand : number = Math.random() * totalWeight

    // weighted random sample; accumulate all weights until we have a sum greater than the random value
    // this amounts to making a number line with all the weights arrayed horizontally and then finding the appropriate
    // place along it
    let chosenJobId: ?string
    let cumulativeWeight : number = 0
    for (let [jobId, weight] of weightsByJob.entries()) {
      cumulativeWeight += weight
      if (cumulativeWeight > rand) {
        chosenJobId = jobId
        break
      }
    }

    if (chosenJobId == null) {
      throw new Error('No job selected, this implies a bug.')
    }

    // we have now chosen a job id, get some work on that job
    return {
      jobId: chosenJobId,
      tasks: this.jobs.get(chosenJobId).getSomeWork(max)
    }
  }

  enqueue (job: Job) {
    console.dir(job)
    this.jobs.set(job.id, job)
    this.jobsByUser.set(job.user, job)
    this.jobsByNetwork.set(job.transportNetworkId, job)
  }

  getStatus (verbose: boolean = false): string {
    let ret = `Job queue status: ${this.tasksWaiting} tasks waiting\n`

    if (verbose) {
      let complete = ''
      let incomplete = ''

      for (let job of this.jobs.values()) {
        // NB number waiting to be delivered may be incorrect because we don't mark tasks for redelivery until we try to give out tasks on a particular graph.
        // It probably doesn't make sense to do fairly heavy redelivery marking here as this is just for logging purposes, and we don't want to introduce any
        // race conditions from unnecessary complexity.
        let out = `Job ${job.id} (${job.name}): ${job.nComplete} of ${job.size} completed, ${job.size - job.delivered.cardinality()} tasks remain to be delivered on (re)delivery iteration ${job.iteration}\n` +
          `    (last delivery: ${job.lastDeliveryTime > 0 ? moment(job.lastDeliveryTime).fromNow() : 'never'})\n`
    
        if (job.done) complete += out
        else incomplete += out
      }

      ret = `${ret}\nIncomplete jobs:\n${incomplete}\nComplete jobs:\n${complete}`
    }

    return ret
  }
}