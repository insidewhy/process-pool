import _ from 'lodash'
import Promise from 'bluebird'
import FunctionPool from '../FunctionPool'

var delay = time => new Promise(resolve => setTimeout(resolve, time))

describe('function pool', () => {
  it('should schedule a single function call', () => {
    var pool = new FunctionPool([ arg => Promise.resolve(arg + 5) ])

    return pool.call(4).then(result => {
      result.should.equal(9)
    })
  })

  it('should schedule four calls over two functions', () => {
    var defs = _.range(0, 4).map(Promise.defer)
    var nCalls = 0
    var pool = new FunctionPool(_.range(0, 2).map(idx => () => {
      return defs[nCalls++].promise
    }))
    var promises = _.range(0, 4).map(() => pool.call())

    return delay(10).then(() => {
      nCalls.should.equal(2)
      defs[1].fulfill()
      return promises[1]
    })
    .then(() => {
      nCalls.should.equal(3)
      defs[0].fulfill()
      return promises[0]
    })
    .then(() => {
      nCalls.should.equal(4)
      defs[2].fulfill()
      defs[3].fulfill()
      return Promise.all(promises.slice(2))
    })
  })
})
