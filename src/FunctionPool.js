import Promise from 'bluebird'

/**
 * This schedules work out to a number of promise returning functions, after
 * each function has been called it will remain unavailable for future calls
 * until the promise returned by the outstanding call is resolved or rejected.
 */
export default class {
  constructor(funcs) {
    // functions ready to be called
    this.free = funcs.slice(0)
    this.callQueue = []
  }

  /**
   * Call one of the free functions with the given arguments, if none are
   * free then the work is queued.
   * @return {Promise} Resolves to the result of calling the pooled function
   *                   with the given arguments.
   */
  call(...args) {
    return this._getNextFreeFunction().then(
      func => func(...args).then(result => {
        this._promiseFulfilled(func)
        return result
      })
    )
  }

  /**
   * Return a function that modifies the interface of this function pool
   * allowing it to be called like a regular promise-returning function.
   */
  facade() {
    return this.call.bind(this)
  }

  /**
   * Return a promise that resolves to the next free function.
   */
  _getNextFreeFunction() {
    if (this.free.length) {
      return Promise.resolve(this.free.shift())
    }
    else {
      var deferred = Promise.pending()
      this.callQueue.push(deferred)
      return deferred.promise
    }
  }

  /**
   * Notify this pool that a function can be returned to the free pool.
   */
  _promiseFulfilled(func) {
    if (this.callQueue.length)
      this.callQueue.shift().fulfill(func)
    else
      this.free.push(func)
  }
}
