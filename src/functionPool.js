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
      return Promise.resolve(free.shift())
    }
    else {
      var deferred = Promise.pending()
      callQueue.push(deferred)
      return deferred.promise
    }
  }

  var promiseFulfilled = func => {
    if (callQueue.length)
      callQueue.shift().fulfill(func)
    else
      free.push(func)
  }

  var ret = (...args) => getNextFreeFunction().then(
    func => {
      running.push(func)
      return func(...args).then(result => {
        running.splice(running.indexOf(func), 1)
        promiseFulfilled(func)
        return result
      })
    }
  )
  ret.running = running
  return ret
}
