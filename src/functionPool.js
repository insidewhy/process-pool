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
      // TODO: non-resolving promisifying version
      return Promise.resolve(free.shift())
    }
    else {
      var deferred = Promise.pending()
      callQueue.push(deferred)
      return deferred.promise
    }
  }

  var addToFreeQueue = func => {
    if (callQueue.length)
      callQueue.shift().fulfill(func)
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
    running.splice(running.indexOf(func), 1)
    addToFreeQueue(func)
  }

  var ret = (...args) => getNextFreeFunction().then(
    func => {
      running.push(func)
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
  ret.running = running
  ret.replace = replace
  return ret
}
