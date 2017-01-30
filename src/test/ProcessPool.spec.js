import Promise from 'bluebird'
import ProcessPool from '../ProcessPool'
import invert from '../invert'

describe('process pool', () => {
  let pool
  beforeEach(() => pool = new ProcessPool({ processLimit: 2 }))
  afterEach(() => pool.destroy())

  it('should create a sub-process that can accept arguments and return a value', () => {
    const func = pool.prepare(() => (arg1, arg2) => arg1 * arg2 * 10)
    return func(2, 3).then(v => {
      func.running.length.should.equal(0)
      v.should.equal(60)
    })
  })

  it(
    'ready() call should return promise that resolves when all subprocesses are ready',
    () => {
      const func = pool.prepare(() => () => {})
      return pool.ready()
    }
  )

  it(
    'should create a sub-process that can accept arguments and return a value from a Promise',
    () => {
      const func = pool.prepare(() => {
        const Promise = require('bluebird')
        return (arg1, arg2) => Promise.resolve(arg1 * arg2 * 10)
      })
      return func(2, 3).then(v => {
        v.should.equal(60)
      })
    }
  )

  it('should catch a thrown exception in a sub-process and fail the promise', done => {
    const func = pool.prepare(() => (arg1, arg2) => { throw Error('ohno') })
    return invert(func(2, 3)).then(err => {
      err.message.should.equal('ohno')
      done()
    })
  })

  it('should pass context to prepare call', () => {
    const func = pool.prepare(ctxt => {
      const Promise = require('bluebird')
      return (arg1, arg2) => Promise.resolve(arg1 + arg2 + ctxt)
    }, 10)
    return func(2, 3).then(v => {
      v.should.equal(15)
    })
  })

  it('should require node modules using the parent process module.paths', () => {
    module.paths.push(__dirname + '/node_modules.test')

    const func = pool.prepare(ctxt => {
      const friender = require('friender')
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

  it('should schedule three calls across two processes', () => {
    const subprocFunc = pool.prepare(() => {
      const Promise = require('bluebird')
      return () => Promise.delay(Date.now(), 100)
    })

    return pool.ready().then(() => {
      return Promise.all([ subprocFunc(), subprocFunc(), subprocFunc() ])
    })
    .then(vals => {
      vals.length.should.equal(3)
      Math.abs(vals[0] - vals[1]).should.be.below(50)
      const longDiff = (vals[2] - vals[1])
      longDiff .should.be.above(99)
    })
  })

  it('should kill active process when requested', () => {
    const subprocFunc = pool.prepare(() => {
      const Promise = require('bluebird')
      return () => Promise.delay(Date.now(), 100)
    })
    const func = pool.preparedFuncs[0]

    return pool.ready().then(() => {
      func.pool.free.length.should.equal(2)
      func.pool.running.length.should.equal(0)

      const callPromise = subprocFunc()

      return Promise.delay(10).then(() => {
        func.pool.free.length.should.equal(1)
        func.pool.running.length.should.equal(1)
        const killed = subprocFunc.kill()
        killed.length.should.equal(1)
        return invert(callPromise)
      })
    })
    .then(err => {
      err.message.should.equal('killed')
      func.subProcesses.length.should.equal(2)
      func.pool.free.length.should.equal(2)
      func.pool.running.length.should.equal(0)

      // wait for replace function to ready...
      return pool.ready()
    })
    .then(() => {
      return Promise.all([ subprocFunc(), subprocFunc() ])
    })
    .then(vals => {
      vals.length.should.equal(2)
      Math.abs(vals[0] - vals[1]).should.be.below(50)
    })
  })
})
