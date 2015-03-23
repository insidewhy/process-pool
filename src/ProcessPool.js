import Promise from 'bluebird'
import child_process from 'child_process'
import path from 'path'

/**
 * Pool class with fields:
 *  * length: Number of processes to run at any one time
 */
export default class {
  // TODO: default to number of CPU cores
  constructor({ length = 4 } = {}) {
    this.length = length
    this.running = []
    this.subProcesses = []
    this.queue = []
  }

  prepare(func) {
    var subProcess = child_process.fork(
      path.join(__dirname, 'childProcess'),
      [ func.toString() ]
    )
    return this._runInSubprocess.bind(this, subProcess)
  }

  _runInSubprocess(subProcess, ...args) {
    // TODO: schedule so that at most this.length sub processes can run
    // TODO: detect subprocess exit failure
    return new Promise(resolve => {
      subProcess.once('message', res => {
        resolve(JSON.parse(res))
        // TODO: remove from this.subProcesses and schedule item from queue
      })
      subProcess.send(JSON.stringify(args))
    })
  }
}
