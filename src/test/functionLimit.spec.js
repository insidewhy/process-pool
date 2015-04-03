import _ from 'lodash'
import Promise from 'bluebird'
import functionLimit from '../functionLimit'

var delay = time => new Promise(resolve => setTimeout(resolve, time))

describe('function limit', () => {
  it('should limit active promises to two, queuing third call', () => {
    var defs = _.range(0, 3).map(Promise.defer)
    var nCalls = 0
    var pool = functionLimit(() => { return defs[nCalls++].promise }, 2)
    var promises = _.range(0, 3).map(() => pool())

    return delay(10).then(() => {
      nCalls.should.equal(2)
      defs[0].fulfill()
      return promises[0]
    })
    .then(() => {
      nCalls.should.equal(3)
      defs[1].fulfill()
      defs[2].fulfill()
      return Promise.all(promises.slice(1))
    })
  })
})
