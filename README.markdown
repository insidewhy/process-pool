# process-pool

[![Circle CI](https://circleci.com/gh/nuisanceofcats/process-pool.png)](https://circleci.com/gh/nuisanceofcats/process-pool)

*This project is not ready yet, you may start relying on it shortly.*

process-pool allows you to maintain a set of sub-processes with a cached state then multiplex them over several CPU cores.

## Using process pool

```javascript
var moment = require('moment')
var ProcessPool = require('process-pool')

// Limit number of running processes to two.
var pool = new ProcessPool({ processLimit: 2 })

var begin = moment()
function time() { return moment().diff(start, 'seconds') }

var func = pool.prepare(function() {
  // code here is run in the subprocess before it is first called, this allows you
  // to cache state in the subprocess so that it is immediately available.

  // this is the function run in the sub-process whenever the wrapping function
  // is called from a sub-process.
  return function(value) {
    return new Promise(function(resolve) {
      console.log('begin %s: %s', time(), returnValue)
      setTimeout(function() { resolve(p * 10) }, 1000)
    })
  }
})

for (var i = 1; i < 4; ++i) {
  func(i).then(function(returnValue) {
    console.log('end %s: %s', time(), returnValue)
  })
}
```

This would print:
```
begin 0: 1
begin 0: 2
end 1: 10
end 1: 20
begin 1: 3
end 2: 30
```

The process pool is set to run two processes concurrently, this delays the execution of the third call by a second.

## Running multiple functions with a single pool

Many functions can be wrapped to run in a subprocess by a single pool via calls to `prepare` using the `processLimit` option as shown in the previous example. By default `processLimit` copies of each `prepare`d function are created (so up to `processLimit` * `number of calls to prepare` can be created). This can be restricted on a per function basis:

```javascript
var Promise = require('bluebird')
var ProcessPool = require('process-pool')
var pool = new ProcessPool({ processLimit: 3 })

// Return a promise that delays execution for the given time period.
function delay(milliseconds) {
  return new Promise(function(resolve) {
    setTimeout(resolve, milliseconds)
  }
}

var twoFunc = pool.prepare(function() {
  var nCalls = 0
  return function() {
    console.log("twoFunc", ++nCalls)
    return delay(1000)
  }
}, { processLimit: 2 })

var oneFunc = pool.prepare(function() {
  var nCalls = 0
  return function() {
    console.log("oneFunc", ++nCalls)
    return delay(1000)
  }
}, { processLimit: 1 })

twoFunc()
twoFunc()
twoFunc()
oneFunc()
```

This would print:

```
twoFunc 1
twoFunc 2
oneFunc 1
```
followed by
```
twoFunc 3
```
a second later.
