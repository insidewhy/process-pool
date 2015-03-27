import Promise from 'bluebird'
import FunctionPool from '../FunctionPool'

describe('function pool', () => {
  it('should schedule a single function call', () => {
    var pool = new FunctionPool([ arg => Promise.resolve(arg + 5) ])

    return pool.call(4).then(result => {
      result.should.equal(9)
    })
  })

  xit('should schedule three calls over two functions', () => {
  })
})
