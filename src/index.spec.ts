import { World, getComponent, Component, ID, getComponents, hasComponent, getID } from './index'

test('basic ecs functionality works', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn(entities => entities.forEach(e => {
    getComponent(e, Counter).counter += 1
  }))

  world.register(
    System,
    [Counter]
  )

  const e = world.createEntity(
    [
      [Counter, 0]
    ]
  )

  expect(hasComponent(e, Counter)).toBe(true)

  world.run()

  expect(System).toHaveBeenCalledTimes(1)
  expect(System).toHaveBeenCalledWith([e])
  expect(getComponent(e, Counter).counter).toBe(1)
})

test('getting components works', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  class OtherComponent {
    constructor(counter) {
      this.counter = counter
    }
  }

  const e = world.createEntity(
    [
      [Counter, 0],
      [OtherComponent, 0]
    ]
  )

  expect(getComponent(e, Counter).counter).toBe(0)
})

test('adding components works', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  class OtherComponent {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn(entities => entities.forEach(e => {
    getComponent(e, Counter).counter += 1
  }))

  world.register(
    System,
    [
      Counter,
      OtherComponent
    ]
  )

  const e = world.createEntity(
    [[Counter, 0]]
  )

  world.run()

  expect(System).toHaveBeenLastCalledWith([])

  expect(world.query([OtherComponent]).length).toBe(0)

  world.addComponent(e, OtherComponent, 2)

  expect(world.query([OtherComponent], true).length).toBe(1)

  world.run()

  expect(System).toHaveBeenLastCalledWith([e])

  expect((world as any)._queries.OtherComponent.entities).toContain(e)

})

test('you can persist queries for faster retrieval', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const e = world.createEntity(
    [[Counter, 0]]
  )

  expect(world.query([Counter], true).length).toBe(1)

  expect((world as any)._queries.Counter.entities).toContain(e)
})

test('removing components works', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  class OtherComponent {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn(entities => entities.forEach(e => {
    getComponent(e, Counter).counter += 1
  }))

  world.register(
    System,
    [Counter,
      OtherComponent]
  )

  const e = world.createEntity(
    [[Counter, 0],
    [OtherComponent, 1]]
  )

  world.run()

  expect(System).toHaveBeenLastCalledWith([e])

  expect(world.query([OtherComponent]).length).toBe(1)

  world.removeComponent(e, OtherComponent)

  expect(world.query([OtherComponent]).length).toBe(0)

  world.run()

  expect(System).toHaveBeenLastCalledWith([])

})

test('all entities should have ID components', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const e = world.createEntity(
    [[Counter, 0]]
  )

  expect(typeof (e.ID.id)).toBe('string')
  expect(+e.ID.id).toBeGreaterThan(0)
})

test('entities are deleted when all non-ID components are removed', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const e = world.createEntity([
    [Counter, 0],
    [ID, { id: '1' }]
  ])

  expect(Object.values(world._entities).length).toBe(1)
  world.removeComponent(e, Counter)
  expect(Object.values(world._entities).length).toBe(0)
})

test('entities created with ID components use the given id', () => {
  const world = new World()

  const e = world.createEntity([
    [ID, { id: 'abc' }]
  ])

  expect(world.get('abc')).toBe(e)
  expect(getID(e)).toBe('abc')
})

test('updating components works, and triggers subscriptions', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(
    System,
    [Counter],
  )

  const e = world.createEntity(
    [[Counter, 0]]
  )

  const subscription = jest.fn()

  const unsub = world.subscribe([Counter], subscription)

  world.updateComponent(e, Counter, (c) => {
    c.counter++
  })

  expect(getComponent(e, Counter).counter).toBe(1)
  expect(subscription).toHaveBeenCalledTimes(1)
  expect(subscription).toHaveBeenLastCalledWith([e])

  world.updateComponent(e, Counter, new Counter(5))
  expect(getComponent(e, Counter).counter).toBe(5)

  expect(subscription).toHaveBeenCalledTimes(2)

  unsub()
})

test('you can optionally pass messages to world.run', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(
    System,
    [Counter],
  )

  const e = world.createEntity(
    [[Counter, 0]]
  )

  world.run(12, 'foo')

  expect(System).toHaveBeenLastCalledWith(12, 'foo', [e])

})

test('you can configure lifecycle hooks', () => {
  const onBefore = jest.fn()
  const onAfter = jest.fn()
  const world = new World({
    onAfter,
    onBefore
  })

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(
    System,
    [Counter],
  )

  world.createEntity(
    [[Counter, 0]]
  )

  world.run(12)

  expect(onBefore).toHaveBeenLastCalledWith(12)
  // expect(onAfter).toHaveBeenLastCalledWith(12)
})

test('you can subscribe to entity updates', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(
    System,
    [Counter]
  )

  const e1 = world.createEntity(
    [[Counter, 0]]
  )

  const subscription = jest.fn()

  const unsub = world.subscribe([Counter], subscription, true)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  const e2 = world.createEntity(
    [[Counter, 0]]
  )

  expect(subscription).toHaveBeenLastCalledWith([e1, e2])

  world.removeComponent(e2, Counter)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  world.updateComponent(e1, Counter, (c) => c.counter++)

  expect(subscription).toHaveBeenCalledTimes(4)

  unsub()
})

test('you can subscribe using a reusable factory function', () => {
  const world = new World()

  class Counter {
    constructor(counter) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(
    System,
    [Counter]
  )

  const e1 = world.createEntity(
    [[Counter, 0]]
  )

  const subscription = jest.fn()

  const useSubscription = world.makeSubscription([Counter], true)

  const unsub = useSubscription(subscription)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  const e2 = world.createEntity(
    [[Counter, 0]]
  )

  expect(subscription).toHaveBeenLastCalledWith([e1, e2])

  world.removeComponent(e2, Counter)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  world.updateComponent(e1, Counter, (c) => c.counter++)

  expect(subscription).toHaveBeenCalledTimes(4)

  unsub()
})

it('exports a generic component that takes whatever', () => {
  class Position extends Component<{ x: number, y: number }> { }

  const world = new World()

  const e = world.createEntity(
    [
      [Position, { x: 0, y: 0 }]
    ]
  )

  expect(getComponent(e, Position).x).toBe(0)
})

it('the readme example should work', () => {
  const world = new World()

  // create a component, components must have a name property and be newable, so class components also work
  function Position(pos) {
    this.pos = pos
    return this
  }
  function Velocity(vel) {
    this.vel = vel
    return this
  }

  // create a system that is called with entities every time world.run is called
  function System(entities) {
    entities.forEach(e => {
      getComponent(e, Position).pos += getComponent(e, Velocity).vel
    })
  }

  // register the System to receive entities with both position and velocity components
  world.register(
    System,
    [Position,
      Velocity]
  )

  // create an entity
  const e = world.createEntity(
    [[Position, 0],
    [Velocity, 2]]
  )

  // execute all systems in parallel
  world.run()

  expect(getComponent(e, Position).pos).toBe(2)
})