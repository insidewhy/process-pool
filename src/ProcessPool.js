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
      var onExit = () => reject(Error('killed'))
      var onMessage = res => {
        if (typeof res === 'object' && null !== res && ('$$return$$' in res || '$$error$$' in res)) {
          subProcess.removeListener('exit', onExit)
          subProcess.removeListener('message', onMessage)
          if ('$$return$$' in res) {
            resolve(res.$$return$$)
          } else {
            var err = Error(res.$$error$$)
            err.stack = res.stack
            reject(err)
          }
        }
      }
      subProcess.once('exit', onExit)
      subProcess.on('message', onMessage)
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
    { processLimit = this.processLimit, module: _module, onChildProcessSpawned = _.noop } = {}
  )
  {
    var funcData = {
      context,
      module: _module || module.parent,
      subProcesses: [],
      func
    }
    this.preparedFuncs.push(funcData)

    var ret = funcData.pool = functionPool(this._spawnSubprocesses(processLimit, funcData, onChildProcessSpawned))
    ret.kill = this._kill.bind(this, funcData)
    return ret
  }

  _spawnSubprocesses(count, funcData, onChildProcessSpawned = _.noop) {
    var { module, context } = funcData

    var spArgs = {
      $$prepare$$: funcData.func.toString(),
      modulePaths: module.paths,
      moduleFilename: module.filename
    }
    if (context)
      spArgs.context = context

    // TODO: add hooks to detect subprocess exit failure
    var subProcesses = _.range(0, count).map(() => child_process.fork(
      path.join(__dirname, 'childProcess')
    ))

    funcData.subProcesses.push(...subProcesses)

    this.nStarting += subProcesses.length

    return subProcesses.map((subProc, idx) => {
      var spPromise = new Promise(resolve => {
        subProc.send(spArgs)
        subProc.once('message', () => {
          onChildProcessSpawned(subProc)
          this._subProcessReady()
          resolve(subProc)
        })
      })

      var wrapped = wrapSubprocess(spPromise)
      var ret = (...args) => this.limiter(wrapped.bind(this, ...args))
      ret.subProcess = subProcesses[idx]
      return ret
    })
  }

  _kill(funcData) {
    var { pool, subProcesses } = funcData
    var killed = []
    pool.running.forEach(runningFunc => {
      killed.push(runningFunc)
      var { subProcess } = runningFunc
      subProcess.kill()
      subProcesses.splice(subProcesses.indexOf(subProcess), 1)
    })

    if (killed.length > 0) {
      var newFuncs = this._spawnSubprocesses(killed.length, funcData)
      killed.forEach((func, idx) => {
        pool.replace(func, newFuncs[idx])
      })
    }

    return killed.map(funcData => funcData.subProcess.pid)
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
    this.preparedFuncs.forEach(funcData => {
      funcData.subProcesses.forEach(proc => proc.kill())
    })
    this._reset()
  }
}
