import { expect, test, vi } from 'vitest'
import { World, getComponent, hasComponent, hasComponents } from '../lib/index'

interface Entity {
  id: string
  pos: {
    x: number
    y: number
  }
}

test('basic ecs functionality works', async () => {
  const world = new World<Entity>()

  const System = vi.fn()

  System.mockImplementation((entities: Set<Entity>) => {
    for (let e of entities.values()) {
      e.pos.x += 1
      e.pos.y += 1
    }
  })

  world.register(System, ['pos'])

  const e = world.create({ id: 'a', pos: { x: 0, y: 0 } })

  expect(hasComponent(e, 'pos')).toBe(true)
  expect(hasComponents(e, ['pos'])).toBe(true)

  await world.run()

  expect(System).toHaveBeenCalledTimes(1)
  expect(getComponent(e, 'pos')).toMatchObject({ x: 1, y: 1 })
})

test('getting components works', () => {
  const world = new World<Entity>()

  const e = world.create({
    id: 'a',
    pos: {
      x: 0,
      y: 0,
    },
  })

  expect(getComponent(e, 'pos').x).toBe(0)
})

test('adding components works', () => {
  interface AddEntity {
    id: string
    counter: number
    counter2?: number
  }

  const world = new World<AddEntity>()

  const System = vi.fn()

  world.register(System, ['counter', 'counter2'])

  const e = world.create({
    id: 'a',
    counter: 2,
  })

  world.run()

  expect(world.query(['counter2']).size).toBe(0)

  world.addComponents(e, { counter2: 2 })

  expect(world.query(['counter2'], { persist: true }).size).toBe(1)

  expect((world as any).queries.get('counter2').entities).toContain(e)
})

test('you can persist queries for faster retrieval', () => {
  const world = new World<Entity>()

  const e = world.create({
    id: 'a',
    pos: {
      x: 0,
      y: 0,
    },
  })

  expect(world.query(['pos'], { persist: true }).size).toBe(1)
  expect((world as any).queries.get('pos').entities).toContain(e)
})

test('removing components works', () => {
  interface Counter {
    id: string
    counter: number
    counter2: number
  }

  const world = new World<Counter>()

  const System = vi.fn((entities: Set<Counter>) => {
    entities.forEach((e: Counter) => {
      e.counter += 1
    })
  })

  world.register(System, ['counter', 'counter2'])

  const e = world.create({
    id: 'a',
    counter: 0,
    counter2: 0,
  })

  world.run()

  expect(world.query(['counter2']).size).toBe(1)

  world.removeComponents(e, ['counter2'])

  expect(world.query(['counter2']).size).toBe(0)
})

test('all entities should have id components even with no id config', () => {
  const world = new World<{ foo: string }>()

  const e = world.create({ foo: '' })

  expect((e as any).id).toBeTypeOf('number')
})

test('you can pass an ID function to make your own ids', () => {
  const world = new World<{ foo: string }>({ generateId: () => 'foobar' })

  const e = world.create({ foo: '' })

  expect((e as any).id).toBeTypeOf('string')
  expect((e as any).id).toBe('foobar')
})

test('entities are deleted when all non-ID components are removed', () => {
  const world = new World<{ foo: string }>()

  const e = world.create({ foo: 'bar' })

  expect(world.size).toBe(1)
  world.removeComponents(e, ['foo'])
  expect(world.size).toBe(0)
})

test('updating components works, and triggers subscriptions', () => {
  const world = new World<{ foo: string }>()

  const System = vi.fn()

  world.register(System, ['foo'])

  const e = world.create({ foo: 'bar' })

  const subscription = vi.fn()

  const unsub = world.subscribe(['foo'], subscription)

  world.updateComponent(e, 'foo', 'bar')

  expect(getComponent(e, 'foo')).toBe('bar')
  expect(subscription).toHaveBeenCalledTimes(1)
  expect(subscription).toHaveBeenLastCalledWith(new Set([e]))

  world.updateComponent(e, 'foo', () => 'baz')
  expect(getComponent(e, 'foo')).toBe('baz')

  expect(subscription).toHaveBeenCalledTimes(2)

  unsub()
})

test('you can update multiple components', () => {
  interface Point {
    x: number
    y: number
  }

  const world = new World<{ pos: Point; vel: Point }>()

  const e1 = world.create({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
  })

  world.updateComponents(e1, [
    ['pos', { x: 1, y: 1 }],
    ['vel', () => ({ x: 2, y: 2 })],
  ])

  expect(getComponent(e1, 'pos')).toMatchObject({ x: 1, y: 1 })
  expect(getComponent(e1, 'vel')).toMatchObject({ x: 2, y: 2 })
})

test('you can optionally pass messages to world.run', () => {
  const world = new World<{ counter: number }>()

  const System = vi.fn()

  world.register(System, ['counter'])

  const e = world.create({ counter: 0 })

  world.run(12, 'foo')

  // expect(System).toHaveBeenLastCalledWith(12, 'foo', new Set([e]))
})

test('you can configure lifecycle hooks', async () => {
  const onBefore = vi.fn()
  const onAfter = vi.fn()
  const world = new World({
    onAfter,
    onBefore,
  })

  const System = vi.fn()

  world.register(System, ['counter'])

  await world.run(12)

  expect(onBefore).toHaveBeenLastCalledWith(12)
  expect(onAfter).toHaveBeenLastCalledWith(12)
})

test('you can subscribe to entity updates', () => {
  const world = new World<{ counter: number }>()

  const System = vi.fn()

  world.register(System, ['counter'])

  const e1 = world.create({ counter: 0 })

  const subscription = vi.fn()

  const unsub = world.subscribe(['counter'], subscription, { emit: true })

  expect(subscription).toHaveBeenLastCalledWith(new Set([e1]))

  const e2 = world.create({ counter: 2 })

  expect(subscription).toHaveBeenLastCalledWith(new Set([e1, e2]))

  world.removeComponents(e2, ['counter'])

  expect(subscription).toHaveBeenLastCalledWith(new Set([e1]))

  world.updateComponent(e1, 'counter', (c) => {
    c++
    return c
  })

  expect(subscription).toHaveBeenCalledTimes(5)

  unsub()
})

test('you can register change handlers that that trigger with entity changed and a list of changes', () => {
  interface Point {
    x: number
    y: number
  }

  const world = new World<{ pos: Point; vel: Point }>()

  const e1 = world.create({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
  })

  const subscription = vi.fn()

  const unsub = world.onUpdate(['pos'], subscription)

  const newPosition = { x: 2, y: 2 }
  world.updateComponent(e1, 'pos', newPosition)

  expect(subscription).toHaveBeenLastCalledWith(e1, [['pos', newPosition]])

  unsub()
})

test('you can subscribe using a reusable factory function', async () => {
  const world = new World<{ counter: number }>()

  const System = vi.fn()

  world.register(System, ['counter'])

  const e1 = world.create({ counter: 1 })

  const subscription = vi.fn()

  const useSubscription = world.makeSubscription(['counter'], { emit: true })

  const unsub = useSubscription(subscription)

  expect(subscription).toHaveBeenCalledWith(new Set([e1]))

  const e2 = world.create({ counter: 2 })

  expect(subscription).toHaveBeenCalledWith(new Set([e1, e2]))

  // This will fire subscriptions twice because it also removes the entity
  world.removeComponents(e2, ['counter'])

  expect(subscription).toHaveBeenCalledWith(new Set([e1]))

  world.updateComponent(e1, 'counter', (c) => {
    return c + 1
  })

  expect(subscription).toHaveBeenCalledTimes(5)

  unsub()
})

function sleep(n = 0) {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
