import Promise from 'bluebird'
import ProcessPool from '../ProcessPool'

describe('process pool', () => {
  it('should create a sub-process that can accept arguments and return a value', () => {
    var pool = new ProcessPool
    var func = pool.prepare(() => (arg1, arg2) => arg1 * arg2 * 10)
    return func(2, 3).then(v => {
      v.should.equal(60)
    })
  })

  it(
    'should create a sub-process that can accept arguments and return a value from a Promise',
    () => {
      var pool = new ProcessPool
      var func = pool.prepare(() => (arg1, arg2) => Promise.resolve(arg1 * arg2 * 10))
      return func(2, 3).then(v => {
        v.should.equal(60)
      })
    }
  )
})
