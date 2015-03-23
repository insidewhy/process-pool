# process-pool

[![Circle CI](https://circleci.com/gh/nuisanceofcats/process-pool.png)](https://circleci.com/gh/nuisanceofcats/process-pool)

*This project is not ready yet, you may start relying on it shortly.*

process-pool allows you to maintain a set of sub-processes with a cached state then multiplex them over several CPU cores.

## Using process pool

```javascript
var ProcessPool = require('process-pool')
var pool = new ProcessPool

var func = pool.prepare(function() {
  // code here is run in the subprocess before it is first called, this allows you
  // to cache state in the subprocess so that it is immediately available.

  // this is the function run in the sub-process whenever the wrapping function
  // is called from a sub-process.
  return function(value) {
    return new Promise(function(resolve) {
      setTimeout(function() { resolve(p * 2) }, 1000)
    })
  }
})

func(1).then(function(returnValue) {
  console.log(returnValue)
})

func.restart(2).then(function(returnValue) {
  console.log(returnValue)
})
```

This would print "4" after 1000 seconds. The first invocation gets replaced by the call to `restart`.
