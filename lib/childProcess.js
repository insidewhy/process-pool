// This file is not es6 to avoid adding "use strict" at the top and disabling eval
var Promise = require('bluebird')

var func

process.on('message', function(args) {
  args = JSON.parse(args)
  if (args.$$prepare$$) {
    module.paths = args.modulePaths
    module.filename = args.moduleFilename

    var funcStr = args.$$prepare$$
    eval(
      // This changes the passed function into one called "prepare".
      funcStr.replace(/^function( +\w+)? */, 'function prepare')
    )
    func = prepare.call(this, args.context)

    process.send('$$ready$$')
    return
  }

  Promise.try(function() {
    return func.apply(this, args)
  })
  .then(function(returnValue) {
    process.send(JSON.stringify(returnValue))
  })
  .catch(function(error) {
    var message = error.message, stack
    if (message)
      stack = error.stack
    else
      message = error

    process.send({ $$error$$: message, stack: stack })
  })
})
