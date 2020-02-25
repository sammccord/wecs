# `(wee)` Entity Component System

> A **tiny** Entity Component System for Javascript. 0 deps, ~1k gzipped

![](https://img.badgesize.io/sammccord/wecs/master/dist/index.umd.js.svg)
![](https://img.badgesize.io/sammccord/wecs/master/dist/index.umd.js.svg?compression=gzip)

## Features

* Super small & simple
* Unopinionated - no classes to extend, bring your own batteries
* Flexible - Use ECS or Observer pattern to interact with entities, any class can be a component.
* Performant - Doesn't re-implement a GC, entities are deleted when they have no components and fall out of scope, avoids unnecessary iteration.

- [`(wee)` Entity Component System](#wee-entity-component-system)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [API](#api)
    - [`World`](#world)
      - [`constructor(config: Config = {})`](#constructorconfig-config)
      - [`addComponent<T>(entity: Entity, Component: Component<T>, ...args: any[])`](#addcomponenttentity-entity-component-componentt-args-any)
      - [`addComponents(entity: Entity, components: [Component<unknown>, ...any[]][])`](#addcomponentsentity-entity-components-componentunknown-any)
      - [`createEntity(components: [Component<unknown>, ...any[]][]): Entity`](#createentitycomponents-componentunknown-any-entity)
      - [`query(components: Component<unknown>[]): Entity[]`](#querycomponents-componentunknown-entity)
      - [`register(system: Function, components: Component<unknown>[])`](#registersystem-function-components-componentunknown)
      - [`removeComponent<T>(entity: Entity, component: Component<T>)`](#removecomponenttentity-entity-component-componentt)
      - [`removeComponents(entity: Entity, components: Component<unknown>[])`](#removecomponentsentity-entity-components-componentunknown)
      - [`async run(...args: any[]): Promise<void>`](#async-runargs-any-promisevoid)
      - [`subscribe(components: Component<unknown>[], callback: QueryCallback, emit?: boolean): Function`](#subscribecomponents-componentunknown-callback-querycallback-emit-boolean-function)
      - [`unsubscribe(components: Component<unknown>[], callback: QueryCallback)`](#unsubscribecomponents-componentunknown-callback-querycallback)
      - [`updateComponent<T>(entity: Entity, Component, updater: (component: T) => T)`](#updatecomponenttentity-entity-component-updater-component-t--t)
    - [`getComponent<T>(entity: Entity, Component: Component<T>): T`](#getcomponenttentity-entity-component-componentt-t)
    - [`hasComponent<T>(entity: Entity, components: Component<T>)`](#hascomponenttentity-entity-components-componentt)
    - [`hasComponents(entity: Entity, components: Component<unknown>[])`](#hascomponentsentity-entity-components-componentunknown)

## Installation

```bash
yarn add wecs
```

## Quick Start

For a more complete example, see [the examples which don't exist yet](./example/basic.ts)

```js
import World, { getComponent } from 'wecs'

// instantiate the world
const world = new World()

// create a component
class Position {
  constructor(pos) {
    this.pos = pos
  }
}
class Velocity {
  constructor(vel) {
    this.vel = vel
  }
}

// create a system that is called with entities every time world.run is called
function System(entities) {
  entities.forEach(e => {
    world.updateComponent(e, Position, c => {
      c.pos += getComponent(e, Velocity).vel
    })
  })
}

// register the System to receive entities with both position and velocity components
world.register(
  System,
  [
    Position,
    Velocity
  ]
)

// create an entity
world.createEntity([
  [Position, 0],
  [Velocity, 2]
])

// execute all systems in parallel
world.run()

```

## API

### `World`

`World` is the default export class containing entities 

#### `constructor(config: Config = {})`

You can construct `World` with the following config shape. All properties are optional.

| Key        | Type                                | Description                                                             |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `parallel` | `boolean`                           | Run all systems in parallel                                             |
| `onBefore` | `(...args: any[]) => Promise<void>` | A function called with an optional message before all systems are run.` |
| `onAfter`  | `(...args: any[]) => Promise<void>` | A function called with an optional message after all systems are run.`  |

#### `addComponent<T>(entity: Entity, Component: Component<T>, ...args: any[])`

Add a single component to a given entity

```js
class Position {
  constructor(number, bar) {
    console.assert(number === 0)
    console.assert(foo === 'foo')
  }
}

world.addComponent(e, Position, 0, 'foo')
```

#### `addComponents(entity: Entity, components: [Component<unknown>, ...any[]][])`

Adds components to a given entity

```js

world.addComponents(
  e,
  [
    [Position, 0, 'foo'],
    [Velocity, 2, 'bar']
  ]
)
```

#### `createEntity(components: [Component<unknown>, ...any[]][]): Entity`

Creates an entity with the provided Components and values.

```js
class Velocity {
  constructor(number, bar) {
    console.assert(number === 2)
    console.assert(foo === 'bar')
  }
}

const entity = world.createEntity([
  [Position, 0, 'foo'],
  [Velocity, 2, 'bar']
])
```

#### `query(components: Component<unknown>[]): Entity[]`

Query all entities that meet the component criteria

```js
const entities = world.query([Position, Velocity])
```

#### `register(system: Function, components: Component<unknown>[])`

Register a system function to be called with entities that meet all of the component criteria:

```js
class Component {
  constructor(counter) {
    this.foo = 'bar'
  }
}

function System(entities) {
  entities.forEach(e => world.updateComponent(e, Component, c => {
    c.foo = 'baz'
  })
}

world.register(System, [Component, OtherComponent, ThirdComponent])
```

#### `removeComponent<T>(entity: Entity, component: Component<T>)`

Removes a single component from a given entity

```js

world.removeComponent(
  e,
  Position
)
```

#### `removeComponents(entity: Entity, components: Component<unknown>[])`

Removes components from a given entity

```js

world.removeComponents(
  e,
  [Position, Velocity]
)
```

#### `async run(...args: any[]): Promise<void>`

Executes all the registered systems. If `args` are present (typically a ms delta of now minus last run, but can be whatever arguments you want), systems will be called with `system(...args, entities)` as opposed to just `system(entities)`.

```js
function System(delta, time, entities) {
  // do stuff
}

function run() {
  // Compute delta and elapsed time
  var time = performance.now()
  var delta = time - lastTime

  // Run all the systems
  world.run(delta, time)

  lastTime = time
  requestAnimationFrame(run)
}

var lastTime = performance.now()
run()
```

**Note:** Dynamic length arguments passed to `.run` at runtime will likely fuxx with your program so try to stick to one function signature for all of your system functions. For example, the following is bad:

```js
// entities won't always be what you want it to be!
function System(entities) {}
function SystemTwo(delta, entities) {}

// this sucks don't do this
if(foo) world.run(delta)
else world.run()
```

#### `subscribe(components: Component<unknown>[], callback: QueryCallback, emit?: boolean): Function`

Subscribe to updates with a callback function that gets executed when:
  * a new entity meeting the component criteria gets created
  * an entity gets a new component that meets the criteria
  * an entity has a component removed that makes it no longer meet the criteria
  * an entity's component is updated via `world.updateComponent`

The third `emit` argument, when `true`, will immediately call the callback with relevant entities.

This method will also return a function you can use to unsubscribe.

```js
const unsubscribe = world.subscribe(
  [Position, Velocity],
  (entities) => console.log(entities),
  true
)

unsubscribe()
```

#### `unsubscribe(components: Component<unknown>[], callback: QueryCallback)`

Another way to unsubscribe, handy for `rxjs`

```js

import { fromEventPattern } from 'rxjs';
 
const addHandler = (components) => (handler) => {
  world.subscribe(components, handler, true)
}
 
const removeHandler = (components) => (handler) => {
  world.unsubscribe(components, handler)
}
 
const entities = fromEventPattern(
  addHandler([Position, Velocity]),
  removeHandler([Position, Velocity])
)

entities.subscribe(entities => console.log(entities))
```

#### `updateComponent<T>(entity: Entity, Component, updater: (component: T) => T)`

Takes an entity, a component, and a callback function that is called with value of the entity's component.

If the callback returns a value, the entity's component will be set to that value.

Afterwards, trigger all relevant subscriptions

```js
class Component {
  constructor(multiplier = 2) {
    this.values = [1, 2, 3].map(v => v * multiplier)
  }
}

world.subscribe([Component], (entities) => {
  // this will be called three times
})

const entity = world.createEntity([
  [Component, 1]
])

world.updateComponent(entity, Component, c => {
  // mutate the component directly
  c.values = []
}

world.updateComponent(e, Component, c => {
    // reset the value
  return new Component(3)
})
```

### `getComponent<T>(entity: Entity, Component: Component<T>): T`

Given an entity, gets the given component or null if the entity doesn't have it.

```js
import { getComponent } from 'wecs'

const entity = world.createEntity([
  [Position, 0],
  [Velocity, 2]
])

const position = getComponent(entity, Position)
```

### `hasComponent<T>(entity: Entity, components: Component<T>)`

Given an entity, gets the given component or null if the entity doesn't have it.

```js
import { hasComponent } from 'wecs'

const entity = world.createEntity([
  [Position, 0],
  [Velocity, 2]
])

console.assert(hasComponent(entity, Position))
```


### `hasComponents(entity: Entity, components: Component<unknown>[])`

Given an entity, gets the given component or null if the entity doesn't have it.

```js
import { hasComponents } from 'wecs'

const entity = world.createEntity([
  [Position, 0],
  [Velocity, 2]
])

console.assert(hasComponents(entity, [Position, Velocity]))
```
