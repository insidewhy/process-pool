import Promise from 'bluebird'
import ProcessPool from '../ProcessPool'

describe('process pool', () => {
  var pool
  beforeEach(() => pool = new ProcessPool)
  afterEach(() => pool.destroy())

  it('should create a sub-process that can accept arguments and return a value', () => {
    var func = pool.prepare(() => (arg1, arg2) => arg1 * arg2 * 10)
    return func(2, 3).then(v => {
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

  // TODO: chai-as-promised doesn't play nice with bluebird, try/write
  //       alternative instead of using done parameter.
  it('should catch a thrown exception in a sub-process and fail the promise', done => {
    var func = pool.prepare(() => (arg1, arg2) => { throw Error('ohno') })
    return func(2, 3).catch(err => {
      err.message.should.equal('ohno')
      done()
    })
  }
  )

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
})
