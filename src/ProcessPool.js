import Promise from 'bluebird'
import child_process from 'child_process'
import path from 'path'
import _ from 'lodash'

import FunctionPool from './FunctionPool'

/**
 * Take sub-process and wrap the messaging to/back into a function that accepts
 * arguments to send over IPC and returns a promise that will resolve to the
 * return value, received via IPC.
 */
function wrapSubprocess(subProcess) {
  // TODO: use utility to bind promise from event instead of creating the promise manually
  return (...args) => new Promise((resolve, reject) => {
    subProcess.once('message', res => {
      if (res.$$error$$)
        reject(JSON.parse(res.$$error$$))
      else
        resolve(JSON.parse(res))
    })

    // TODO: schedule so that at most this.processLimit sub processes can run
    subProcess.send(JSON.stringify(args))
  })
}

/**
 * Pool class with fields:
 *  * length: Number of processes to run at any one time
 */
export default class {
  // TODO: default to number of CPU cores
  constructor({ processLimit = 4 } = {}) {
    this.processLimit = processLimit
    this.running = []
    this.subProcesses = []
    this.queue = []
  }

  prepare(func, { processLimit = this.processLimit, replace = false } = {}) {
    // TODO: add hooks to detect subprocess exit failure
    var subProcesses = _.range(0, processLimit).map(() => child_process.fork(
      path.join(__dirname, 'childProcess'),
      [ func.toString() ]
    ))
    .map(wrapSubprocess)

    var func = new FunctionPool(subProcesses)
    return func.facade()
  }

}
