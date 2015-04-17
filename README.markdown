# process-pool

[![Circle CI](https://circleci.com/gh/ohjames/process-pool.png)](https://circleci.com/gh/ohjames/process-pool)

process-pool allows you to maintain a set of sub-processes with a cached state, creating a process pool that can be used to efficiently delegate work over multiple CPU cores.

## Using process pool

```javascript
var moment = require('moment')
var ProcessPool = require('process-pool')

// Limit number of running processes to two.
var pool = new ProcessPool({ processLimit: 2 })

function time() { return moment().diff(time.start, 'seconds') }
time.start = moment()

var func = pool.prepare(function() {
  // code here is run in the subprocess before it is first called, this allows you
  // to cache state in the subprocess so that it is immediately available.

  // this is the function run in the sub-process whenever the wrapping function
  // is called from a sub-process.
  return function(value) {
    // the promise is used to keep the process active for a second, usually
    // promises would not be used for this purpose in a process pool.
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

Functions past to `prepare` are *not* closures and do not have access to surrounding scope. The following would fail:

```javascript
var ProcessPool = require('process-pool')
var global = 5

var pool = new ProcessPool
var pooled = pool.prepare(function() {
  return function(argument) {
    return argument + global
  }
})
```

`global` is not available within the call to prepare. To pass context to prepare the two argument version of prepare can be used:

```javascript
var ProcessPool = require('process-pool')
var global1 = 2, global2 = 10

var pool = new ProcessPool
var pooled = pool.prepare(function(context) {
  // global module requires are not available and must be required.
  var _ = require('lodash')

  return function(args) {
    return context.multiply * _.max(args) + context.add
  }
}, { multiply: global1, add: global2 })

pool([1, 3]).then(function(value) {
  console.log("The value 16": value)
})
```

## Requiring modules in a sub-process

By the the module path data is inherited from `module.parent` which is the module that included `process-pool`, in many cases this may not be the environment the sup-process should use. In order to use the current module path data the `module` option can be used. In most cases the `module` global variable provided by node should be passed which will case `require` to resolve modules according to module of the current source file.

```javascript
// In this case the 'pooler' module includes 'process-pool', without using
// the `module` argument then require would resolve paths according to the
// 'pooler' module rather than this one.
var pooler = require('pooler')

var pooled = pooler.procPool.prepare(function() {
  var compiler = require('compiler')
  return function(data) {
    return compiler.compile(data)
  }
}, null, { module: module })
```

## Running multiple functions with a single pool

Many functions can be wrapped to run in a subprocess by a single pool via calls to `prepare` using the `processLimit` option as shown in the previous example. By default `processLimit` copies of each `prepare`d function are created. Up to `processLimit` * `number of calls to prepare` can be created but only `processLimit` subprocesses will be running code at any given time, the rest will be sleeping. This can be restricted on a per function basis:

```javascript
var Promise = require('bluebird')
var ProcessPool = require('process-pool')
var pool = new ProcessPool({ processLimit: 3 })

var twoFunc = pool.prepare(function() {
  var nCalls = 0
  return function() {
    console.log("twoFunc", ++nCalls)
    return Promise.delay(1000)
  }
}, { processLimit: 2 })

var oneFunc = pool.prepare(function() {
  var nCalls = 0
  return function() {
    console.log("oneFunc", ++nCalls)
    return Promise.delay(1000)
  }
}, { processLimit: 1 })

twoFunc()
twoFunc()
twoFunc()
oneFunc()
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
oneFunc 2
```
a second later.

## Future work
* Killing a pooled function should drain the wait queue.
