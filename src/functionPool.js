import Promise from 'bluebird'

/**
 * This schedules work out to a number of promise returning functions, after
 * each function has been called it will remain unavailable for future calls
 * until the promise returned by the outstanding call is resolved or rejected.
 */
export default function(funcs) {
  var free = funcs.slice(0)
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

  return (...args) => getNextFreeFunction().then(
    func => func(...args).then(result => {
      promiseFulfilled(func)
      return result
    })
  )
}
