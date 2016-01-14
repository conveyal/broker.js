/**
 * Represents a job being handled by the broker. It's just some bitsets recording what jobs have been delivered
 * and which have been completed.
 */

import BitSet from 'bitset'

const TASK_COMPLETION_TIME_MS = 30 * 1000

export default class Job {
  constructor (size, id) {
    this.size = 0
    this.delivered = new BitSet(31) // 31 is number of bits in word
    this.completed = new BitSet(31)
    this.id = id
    this.loc = 0
    this.lastDeliveryTime = 0
  }

  /** get up to max tasks on this job (returns array of ints) */
  getSomeWork (max) {
    // once we finish delivering all tasks once, check if any need to be redelivered
    if (this.loc === this.size) {
      if (Date.now() - this.lastDeliveryTime < TASK_COMPLETION_TIME_MS) {
        // give tasks a moment to complete
        return []
      }

      if (!this.markTasksForRedelivery()) {
        this.done = true
        return []
      }
    }

    let out = []
    while (this.step() && out.length < max) {
      out.push(this.loc)
      this.delivered.set(this.loc)
    }

    this.lastDeliveryTime = Date.now()

    return out
  }

  /** step forward to the next undelivered task */
  step () {
    while (!this.delivered.get(this.loc)) this.loc++
    return this.loc < this.size
  }

  get completed () {
    return this.completed.cardinality()
  }

  complete (task) {
    if (task < 0 || task >= this.size) {
      console.error(`attempt to complete non-existent task ${task} on job ${this.id}}`)
      return
    }
    this.completed.set(task)
  }

  /**
   * mark tasks that failed to complete for redelivery (i.e. mark them as not being delivered)
   * Rather than having a timeout and tracking them, we just redeliver all failed tasks once all tasks have
   * been delivered; this is much simpler than the previous approach of tracking how long has passed since each task
   * was last delivered.
   *
   * We iterate over the tasks that have not been completed. We will mark all of them for redelivery below; if they
   * again do not complete, we will shortly call this function again and repeat the above process until they complete.
   */
  markTasksForRedelivery () {
    let nComplete = this.completed.cardinality()

    if (nComplete === this.size) return false // nothing to redeliver, hooray

    console.log(`Marking ${this.size - nComplete} tasks for redelivery on job ${this.id}`)

    this.delivered.and(this.completed)
    this.loc = 0 // seek back to beginning

    return true
  }
}
