import Promise from 'bluebird'
import _ from 'lodash'

/**
 * This schedules work out to a number of promise returning functions, after
 * each function has been called it will remain unavailable for future calls
 * until the promise returned by the outstanding call is resolved or rejected.
 */
export default function(funcs) {
  var free = funcs.slice(0)
  var running = []
  var callQueue = []

  var getNextFreeFunction = () => {
    if (free.length) {
      var func = free.shift()
      running.push(func)
      return Promise.resolve(func)
    }
    else {
      return new Promise(resolve => {
        callQueue.push(func => {
          // running.push must be here so it can happen
          // in the same tick as it's removal from `free`
          running.push(func)
          resolve(func)
        })
      })
    }
  }

  var addToFreeQueue = func => {
    if (callQueue.length)
      callQueue.shift()(func)
    else
      free.push(func)
  }

  var replace = (func, replacement) => {
    var idx = running.indexOf(func)
    if (idx !== -1)
      running.splice(idx, 1)
    else
      free.splice(free.indexOf(func), 1)

    addToFreeQueue(replacement)
  }

  var callComplete = func => {
    var runningIdx = running.indexOf(func)
    // it could have been removed by a call to `replace`
    if (runningIdx !== -1) {
      running.splice(runningIdx, 1)
      addToFreeQueue(func)
    }
  }

  var ret = (...args) => getNextFreeFunction().then(
    func => {
      return func(...args).then(result => {
        callComplete(func)
        return result
      })
      .catch(err => {
        callComplete(func)
        throw err
      })
    }
  )

  ret.free = free
  ret.running = running
  ret.replace = replace
  return ret
}
