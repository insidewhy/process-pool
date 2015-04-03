import Promise from 'bluebird'

/**
 * This accepts a promise returning function and returns a function that allows
 * a limited number of unresolved promises to be active. Calls beyond this limit
 * will be queued.
 */
export default function(func, limit) {
  var activeCalls = 0
  var callQueue = []

  var getFreeFunction = () => {
    if (activeCalls < limit) {
      ++activeCalls
      return Promise.resolve()
    }
    else {
      var deferred = Promise.pending()
      callQueue.push(deferred)
      return deferred.promise
    }
  }

  return (...args) => {
    return getFreeFunction().then(() => {
      return Promise.resolve(func(...args)).then(result => {
        if (callQueue.length)
          callQueue.shift().fulfill()
        else
          --activeCalls

        return result
      })
    })
  }
}
