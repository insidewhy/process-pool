// This file is not es6 to avoid adding "use strict" at the top and disabling eval

// This changes the passed function into one called "prepare".
eval(
  process.argv[2].replace(/^function( +\w+)? */, 'function prepare')
)
var func = prepare()

process.on('message', function(args) {
  var ret = func.apply(this, JSON.parse(args))
  process.send(JSON.stringify(ret))
})
