import { World, getComponent, Component, ID, hasComponent, getID } from './index'

test('basic ecs functionality works', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn(entities =>
    entities.forEach((e: any) => {
      getComponent(e, Counter).counter += 1
    })
  )

  world.register(System, [Counter])

  const e = world.createEntity([[Counter, 0]])

  expect(hasComponent(e, Counter)).toBe(true)

  world.run()

  expect(System).toHaveBeenCalledTimes(1)
  expect(System).toHaveBeenCalledWith([e])
  expect(getComponent(e, Counter).counter).toBe(1)
})

test('getting components works', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  class OtherComponent {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const e = world.createEntity([
    [Counter, 0],
    [OtherComponent, 0]
  ])

  expect(getComponent(e, Counter).counter).toBe(0)
})

test('adding components works', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  class OtherComponent {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn(entities =>
    entities.forEach((e: any) => {
      getComponent(e, Counter).counter += 1
    })
  )

  world.register(System, [Counter, OtherComponent])

  const e = world.createEntity([[Counter, 0]])

  world.run()

  expect(System).toHaveBeenLastCalledWith([])

  expect(world.query([OtherComponent]).length).toBe(0)

  world.addComponent(e, OtherComponent, 2)

  expect(world.query([OtherComponent], true).length).toBe(1)

  world.run()

  expect(System).toHaveBeenLastCalledWith([e])

  expect((world as any).queries.OtherComponent.entities).toContain(e)
})

test('you can persist queries for faster retrieval', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const e = world.createEntity([[Counter, 0]])

  expect(world.query([Counter], true).length).toBe(1)

  expect((world as any).queries.Counter.entities).toContain(e)
})

test('removing components works', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  class OtherComponent {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn(entities =>
    entities.forEach((e: any) => {
      getComponent(e, Counter).counter += 1
    })
  )

  world.register(System, [Counter, OtherComponent])

  const e = world.createEntity([
    [Counter, 0],
    [OtherComponent, 1]
  ])

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
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const e = world.createEntity([[Counter, 0]])

  expect(typeof e.ID._.id).toBe('string')
  expect(e.ID._.id.length).toBeGreaterThan(0)
})

test('you can pass an ID function to make your own ids', () => {
  const world = new World({ id: () => 'cool' })

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const e = world.createEntity([[Counter, 0]])

  expect(typeof e.ID._.id).toBe('string')
  expect(e.ID._.id).toEqual('cool')
})

test('entities are deleted when all non-ID components are removed', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const e = world.createEntity([
    [Counter, 0],
    [ID, { id: '1' }]
  ])

  expect(Object.values((world as any).entities).length).toBe(1)
  world.removeComponent(e, Counter)
  expect(Object.values((world as any).entities).length).toBe(0)
})

test('entities created with ID components use the given id', () => {
  const world = new World()

  const e = world.createEntity([[ID, { id: 'abc' }]])

  expect(world.get('abc')).toBe(e)
  expect(getID(e)).toBe('abc')
})

test('updating components works, and triggers subscriptions', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(System, [Counter])

  const e = world.createEntity([[Counter, 0]])

  const subscription = jest.fn()

  const unsub = world.subscribe([Counter], subscription)

  world.updateComponent(e, Counter, (c: any) => {
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

test('you can update multiple components', () => {
  const world = new World()

  class Position extends Component<{ x: number; y: number }> {}
  class Velocity extends Component<{ x: number; y: number }> {}

  const e1 = world.createEntity([
    [Position, { x: 0, y: 0 }],
    [Velocity, { x: 1, y: 1 }]
  ])

  const newPosition = new Position({ x: 1, y: 1 })
  const newVelocity = new Velocity({ x: 1, y: 1 })
  world.updateComponents(e1, [
    [Position, newPosition],
    [Velocity, newVelocity]
  ])

  expect(getComponent(e1, Position).get()).toMatchObject({ x: 1, y: 1 })
  expect(getComponent(e1, Velocity).get()).toMatchObject({ x: 1, y: 1 })
})

test('you can optionally pass messages to world.run', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(System, [Counter])

  const e = world.createEntity([[Counter, 0]])

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
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(System, [Counter])

  world.createEntity([[Counter, 0]])

  world.run(12)

  expect(onBefore).toHaveBeenLastCalledWith(12)
  // expect(onAfter).toHaveBeenLastCalledWith(12)
})

test('you can subscribe to entity updates', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(System, [Counter])

  const e1 = world.createEntity([[Counter, 0]])

  const subscription = jest.fn()

  const unsub = world.subscribe([Counter], subscription, true)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  const e2 = world.createEntity([[Counter, 0]])

  expect(subscription).toHaveBeenLastCalledWith([e1, e2])

  world.removeComponent(e2, Counter)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  world.updateComponent(e1, Counter, (c: any) => c.counter++)

  expect(subscription).toHaveBeenCalledTimes(4)

  unsub()
})

test('you can register change handlers that that trigger with entity changed and a list of changes', () => {
  const world = new World()

  class Position extends Component<{ x: number; y: number }> {}
  class Velocity extends Component<{ x: number; y: number }> {}

  const e1 = world.createEntity([
    [Position, { x: 0, y: 0 }],
    [Velocity, { x: 1, y: 1 }]
  ])

  const subscription = jest.fn()

  const unsub = world.handleChange([Position], subscription)

  const newPosition = new Position({ x: 1, y: 1 })
  world.updateComponent(e1, Position, newPosition)

  expect(subscription).toHaveBeenLastCalledWith(e1, [[Position, newPosition]])

  unsub()
})

test('you can subscribe using a reusable factory function', () => {
  const world = new World()

  class Counter {
    counter: number
    constructor(counter: number) {
      this.counter = counter
    }
  }

  const System = jest.fn()

  world.register(System, [Counter])

  const e1 = world.createEntity([[Counter, 0]])

  const subscription = jest.fn()

  const useSubscription = world.makeSubscription([Counter], true)

  const unsub = useSubscription(subscription)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  const e2 = world.createEntity([[Counter, 0]])

  expect(subscription).toHaveBeenLastCalledWith([e1, e2])

  world.removeComponent(e2, Counter)

  expect(subscription).toHaveBeenLastCalledWith([e1])

  world.updateComponent(e1, Counter, (c: any) => c.counter++)

  expect(subscription).toHaveBeenCalledTimes(4)

  unsub()
})

it('exports a generic component that takes whatever', () => {
  class Position extends Component<{ x: number; y: number }> {}

  const world = new World()

  const e = world.createEntity([[Position, { x: 0, y: 0 }]])
  expect(getComponent(e, Position).get()).toMatchObject({ x: 0, y: 0 })
})
