import Promise from 'bluebird'
import child_process from 'child_process'
import path from 'path'
import _ from 'lodash'

import functionPool from './functionPool'
import functionLimit from './functionLimit'

/**
 * Take sub-process and wrap the messaging to/back into a function that accepts
 * arguments to send over IPC and returns a promise that will resolve to the
 * return value, received via IPC.
 */
function wrapSubprocess(subProcessPromise) {
  // TODO: use utility to bind promise from event instead of creating the promise manually
  return (...args) => subProcessPromise.then(subProcess => {
    subProcess.send(args)

    return new Promise((resolve, reject) => {
      subProcess.once('message', res => {
        if (res.$$error$$) {
          var err = Error(res.$$error$$)
          err.stack = res.stack
          reject(err)
        }
        else {
          resolve(res)
        }
      })
    })
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
    this._reset()
  }

  _reset() {
    this.limiter = functionLimit(func => func(), this.processLimit)
    this.preparedFuncs = []
    this.nStarting = 0 // number of processes starting up
  }

  /**
   * Prepare a function to be run within a process
   * @param {Function} func This function is immediately executed when the
   * subprocess starts and should return another function that will handle
   * each call.
   * @param {Any} context Optional value to pass to the outter function within
   * the subprocess, it must be convertable to JSON.
   * @param {Object|undefined} options processLimit and replace options, usually
   * this.processLimit functions are spawned for each pooled function, this can be
   * used to set the limit lower or higher for a given function. Setting it higher
   * will not allow greater concurrency for this function but will allow the function
   * to deal with processes being killed more quickly.
   */
  prepare(
    func,
    context = undefined,
    { processLimit = this.processLimit, module: _module } = {}
  )
  {
    func.context = context
    func.module = _module || module.parent
    func.subProcesses = []
    var spPromises = this._spawnSubprocesses(processLimit, func)

    var ret = func.pool = functionPool(spPromises.map(
      (spPromise, idx) => {
        var ret = this.limiter(wrapSubprocess.bind(this, spPromise))
        ret.subProcess = func.subProcesses[idx]
        return ret
      }
    ))
    ret.kill = this._kill.bind(this, func)
    return ret
  }

  _spawnSubprocesses(count, func) {
    var { module, context } = func

    var spArgs = {
      $$prepare$$: func.toString(),
      modulePaths: module.paths,
      moduleFilename: module.filename
    }
    if (context)
      spArgs.context = context

    // TODO: add hooks to detect subprocess exit failure
    var subProcesses = _.range(0, count).map(() => child_process.fork(
      path.join(__dirname, 'childProcess')
    ))

    // TODO: append to func.subProcesses instead
    func.subProcesses.push(...subProcesses)

    this.nStarting += subProcesses.length

    return subProcesses.map(subProc => new Promise(resolve => {
      subProc.send(spArgs)
      subProc.once('message', () => {
        this._subProcessReady()
        resolve(subProc)
      })
    }))
  }

  _kill(func) {
    var { pool } = func
    pool.running.forEach(runningFunc => {
      console.log("running", runningFunc, runningFunc.subProcess)
      // TODO: kill runningFunc.subProcess
    })
  }

  _subProcessReady() {
    --this.nStarting
    if (this._onStart && this.nStarting === 0) {
      this._onStart.fulfill()
      delete this._onStart
    }
  }

  /**
   * Return a promise that resolves when all of the subprocesses have started up.
   */
  ready() {
    if (this.nStarting === 0)
      return Promise.resolve()

    if (! this._onStart)
      this._onStart = Promise.pending()
    return this._onStart.promise
  }

  /**
   * Destroy all pooled subprocesses, do not use them after this.
   */
  destroy() {
    // TODO: get from this.preparedFuncs.[subProcesses] instead
    this.preparedFuncs.forEach(func => {
      func.subProcesses.forEach(proc => proc.kill())
    })
    this._reset()
  }
}
