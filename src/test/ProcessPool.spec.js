import Promise from 'bluebird'
import ProcessPool from '../ProcessPool'
import invert from '../invert'

describe('process pool', () => {
  var pool
  beforeEach(() => pool = new ProcessPool({ processLimit: 2 }))
  afterEach(() => pool.destroy())

  it('should create a sub-process that can accept arguments and return a value', () => {
    var func = pool.prepare(() => (arg1, arg2) => arg1 * arg2 * 10)
    return func(2, 3).then(v => {
      func.running.length.should.equal(0)
      v.should.equal(60)
    })
  })

  it(
    'ready() call should return promise that resolves when all subprocesses are ready',
    () => {
      var func = pool.prepare(() => () => {})
      return pool.ready()
    }
  )

  it(
    'should create a sub-process that can accept arguments and return a value from a Promise',
    () => {
      var func = pool.prepare(() => {
        var Promise = require('bluebird')
        return (arg1, arg2) => Promise.resolve(arg1 * arg2 * 10)
      })
      return func(2, 3).then(v => {
        v.should.equal(60)
      })
    }
  )

  it('should catch a thrown exception in a sub-process and fail the promise', done => {
    var func = pool.prepare(() => (arg1, arg2) => { throw Error('ohno') })
    return invert(func(2, 3)).then(err => {
      err.message.should.equal('ohno')
      done()
    })
  })

  it('should pass context to prepare call', () => {
    var func = pool.prepare(ctxt => {
      var Promise = require('bluebird')
      return (arg1, arg2) => Promise.resolve(arg1 + arg2 + ctxt)
    }, 10)
    return func(2, 3).then(v => {
      v.should.equal(15)
    })
  })

  it('should require node modules using the parent process module.paths', () => {
    module.paths.push(__dirname + '/node_modules.test')

    var func = pool.prepare(ctxt => {
      var friender = require('friender')
      // would throw without module.filename being set via module
      require('./node_modules.test/friender/index.js')

      return () => friender.friend || 'unknown'
    })
    // TODO: use indirect require to test this instead of previous line
    // }, null, { module })

    return func().then(v => {
      v.should.equal('treebear')
    })
  })

  it('should kill active process when requested', () => {
    var func = () => {
      var Promise = require('bluebird')
      return arg1 => Promise.delay(100).then(() => arg1 * 10)
    }
    var subprocFunc = pool.prepare(func)

    var callPromise = subprocFunc(7)

    return Promise.delay(10).then(() => {
      subprocFunc.kill()

      return invert(callPromise)
    })
    .then(err => {
      console.log("process terminated", err)
    })
  })
})
