// This file is not es6 to avoid adding "use strict" at the top and disabling eval
var Promise = require('bluebird')

process.once('message', function(args) {
  module.paths = JSON.parse(args[1])
  module.filename = JSON.parse(args[2])

  var funcStr = args[0]
  eval(
    // This changes the passed function into one called "prepare".
    funcStr.replace(/^function( +\w+)? */, 'function prepare')
  )

  var context = args[3]
  var func = prepare.call(this, context && JSON.parse(context))

  process.send('$$ready$$')

  process.on('message', function(args) {
    Promise.try(function() {
      return func.apply(this, JSON.parse(args))
    })
    .then(function(returnValue) {
      process.send(JSON.stringify(returnValue))
    })
    .catch(function(error) {
      process.send({ $$error$$: JSON.stringify(error.message ? error.message : error) })
      // TODO: do something...
    })
  })
})
