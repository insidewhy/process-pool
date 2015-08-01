import Promise from 'bluebird'
import _ from 'lodash'

class PooledFunction {
  constructor(funcs) {
    this.free = funcs.slice(0)
    this.running = []
    this.callQueue = []
  }

  getNextFreeFunction() {
    if (this.free.length) {
      var func = this.free.shift()
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

  addToFreeQueue(func) {
    if (this.callQueue.length)
      this.callQueue.shift()(func)
    else
      this.free.push(func)
  }

  replace(func, replacement) {
    var idx = this.running.indexOf(func)
    if (idx !== -1)
      this.running.splice(idx, 1)
    else
      this.free.splice(this.free.indexOf(func), 1)

    this.addToFreeQueue(replacement)
  }

  callComplete(func) {
    var runningIdx = this.running.indexOf(func)
    // it could have been removed by a call to `replace`
    if (runningIdx !== -1) {
      this.running.splice(runningIdx, 1)
      this.addToFreeQueue(func)
    }
  }

  schedule(...args) {
    return this.getNextFreeFunction().then(func => {
      return func(...args).then(result => {
        this.callComplete(func)
        return result
      })
      .catch(err => {
        this.callComplete(func)
        throw err
      })
    })
  }
}

/**
 * This schedules work out to a number of promise returning functions, after
 * each function has been called it will remain unavailable for future calls
 * until the promise returned by the outstanding call is resolved or rejected.
 */
export default function(funcs) {
  var pooled = new PooledFunction(funcs)

  var ret = pooled.schedule.bind(pooled)
  ret.replace = pooled.replace.bind(pooled)
  ret.free = pooled.free
  ret.running = pooled.running
  return ret
}
