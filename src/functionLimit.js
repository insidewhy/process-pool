import Promise from 'bluebird'

/**
 * This accepts a promise returning function and returns a function that allows
 * a limited number of unresolved promises to be active. Calls beyond this limit
 * will be queued.
 */
export default function(func, limit) {
  let activeCalls = 0
  const callQueue = []

  const getFreeFunction = () => {
    if (activeCalls < limit) {
      ++activeCalls
      return Promise.resolve()
    }
    else {
      const deferred = Promise.pending()
      callQueue.push(deferred)
      return deferred.promise
    }
  }

  const callComplete = () => {
    if (callQueue.length)
      callQueue.shift().fulfill()
    else
      --activeCalls
  }

  return (...args) => {
    return getFreeFunction().then(() => {
      return Promise.resolve(func(...args)).then(result => {
        callComplete()
        return result
      })
      .catch(err => {
        callComplete()
        throw err
      })
    })
  }
}
