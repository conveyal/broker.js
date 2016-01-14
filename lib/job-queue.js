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

export default class JobQueue {

}