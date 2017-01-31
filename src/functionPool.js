import Promise from 'bluebird'
import _ from 'lodash'

class PooledFunction {
  /**
   * @param {Array<Function>} funcs The object manages these functions, ensuring that
   *                                whenever a function is called it may not be
   *                                called again until the promise it returned has
   *                                resolved or rejected.
   */
  constructor(funcs) {
    this.free = funcs.slice(0)
    this.running = []
    this.callQueue = []
  }

  /**
   * @return {Promise<Function>} Resolves to a free function, which may involve
   *                             a delay in order to fulfil the conditions listed
   *                             in the constructor's documentation.
   */
  getNextFreeFunction() {
    if (this.free.length) {
      const func = this.free.shift()
      this.running.push(func)
      return Promise.resolve(func)
    }
    else {
      return new Promise(resolve => {
        this.callQueue.push(func => {
          // running.push must be here so it can happen
          // in the same tick as it's removal from `free`
          this.running.push(func)
          resolve(func)
        })
      })
    }
  }

  _callPriorityFunctions(func) {
    const { priorityWork } = func
    const { resolve, args } = priorityWork.shift()

    // this is implemented recursively so that it can deal with extra priority
    // work that is scheduled while it processes existing priority work
    func(...args).then(result => {
      if (priorityWork.length === 0) {
        delete func.priorityWork
        this.running.splice(this.running.indexOf(func), 1)
        this._addToFreeQueue(func)
        resolve(result)
      }
      else {
        resolve(result)
        this._callPriorityFunctions(func)
      }
    })
  }

  /**
   * Mark a function call as complete, it will be assigned to new work if any
   * is available otherwise it will return to the free queue.
   * @pre function must not be in running queue.
   */
  _addToFreeQueue(func) {
    if (func.priorityWork) {
      this.running.push(func)
      this._callPriorityFunctions(func)
    }
    else if (this.callQueue.length) {
      this.callQueue.shift()(func)
    }
    else {
      this.free.push(func)
    }
  }

  replace(func, replacement) {
    const idx = this.running.indexOf(func)
    if (idx !== -1)
      this.running.splice(idx, 1)
    else
      this.free.splice(this.free.indexOf(func), 1)

    this._addToFreeQueue(replacement)
  }

  _callComplete(func) {
    const runningIdx = this.running.indexOf(func)
    // it could have been removed by a call to `replace`
    if (runningIdx !== -1) {
      this.running.splice(runningIdx, 1)
      this._addToFreeQueue(func)
    }
  }

  /**
   * When the user calls the return value of the higher order function this
   * is the method that gets called to track the wrapped function's state.
   */
  schedule(...args) {
    return this.getNextFreeFunction().then(func => {
      return func(...args).then(result => {
        this._callComplete(func)
        return result
      })
      .catch(err => {
        this._callComplete(func)
        throw err
      })
    })
  }

  all(...args) {
    const { running } = this
    const free = this.free.slice()
    this.free.length = 0

    const promises = free.map(func => func(...args))

    const runningPromises = running.map(func => {
      return new Promise(resolve => {
        const { priorityWork } = func
        const data = { resolve, args }
        if (priorityWork)
          priorityWork.push(data)
        else
          func.priorityWork = [ data ]
      })
    })

    if (runningPromises.length)
      promises.push(...runningPromises)

    running.push(...free)

    return Promise.all(promises)
    .then(results => {
      // or maybe it should be running...
      free.forEach(func => {
        running.splice(running.indexOf(func), 1)
        this._addToFreeQueue(func)
      })
      return results
    })
  }
}

/**
 * Like a higher order functions but takes an array of functions and returns a single
 * function that manages the passed functions using ProcessPool.
 * @return {Function} Arguments passed to this function are managed with
 *                    ProcessPool.prototype.schedule.
 */
export default function(funcs) {
  const pooled = new PooledFunction(funcs)

  const ret = pooled.schedule.bind(pooled)
  ret.replace = pooled.replace.bind(pooled)
  ret.all = pooled.all.bind(pooled)
  ret.free = pooled.free
  ret.running = pooled.running
  return ret
}
