# process-pool

[![Circle CI](https://circleci.com/gh/nuisanceofcats/process-pool.png)](https://circleci.com/gh/nuisanceofcats/process-pool)

*This project is not ready yet, you may start relying on it shortly.*

process-pool allows you to maintain a set of sub-processes with a cached state then multiplex them over several CPU cores.

## Using process pool

```javascript
var ProcessPool = require('process-pool')
var pool = new ProcessPool({ length: 2 })

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

var begin = moment()
for (var i = 0; i < 3; ++i) {
  func(i).then(function(returnValue) {
    console.log("%s: %s", moment().diff(start, 'seconds'), returnValue)
  })
}
```

This would print:
```
1: 0
1: 2
2: 4
```

The third result comes a second after the first due to the limited process queue length.
