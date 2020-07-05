# `(wee)` Entity Component System

> A **tiny** Entity Component System for Javascript. 0 deps, ~2k gzipped

![](https://img.badgesize.io/sammccord/wecs/master/dist/index.umd.js.svg)
![](https://img.badgesize.io/sammccord/wecs/master/dist/index.umd.js.svg?compression=gzip)

## Features

* Super small & simple
* Flexible - Use ECS or Observer pattern to interact with entities, any class can be a component.
* Performant - Doesn't re-implement a GC, entities are deleted when they have no components and fall out of scope, avoids unnecessary iteration.

- [`(wee)` Entity Component System](#wee-entity-component-system)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [API](#api)
    - [`World`](#world)
      - [`constructor(config: Config = {})`](#constructorconfig-config--)
      - [`addComponent<T>(entity: Entity, Component: Component<T>, ...args: any[])`](#addcomponenttentity-entity-component-componentt-args-any)
      - [`addComponents(entity: Entity, components: [Component<unknown>, ...any[]][])`](#addcomponentsentity-entity-components-componentunknown-any)
      - [`createEntity(components: [Component<unknown>, ...any[]][]): Entity`](#createentitycomponents-componentunknown-any-entity)
      - [`query(components: Component<unknown>[], persist?: Boolean): Entity[]`](#querycomponents-componentunknown-persist-boolean-entity)
      - [`register(system: Function, components: Component<unknown>[])`](#registersystem-function-components-componentunknown)
      - [`removeComponent<T>(entity: Entity, component: Component<T>)`](#removecomponenttentity-entity-component-componentt)
      - [`removeComponents(entity: Entity, components: Component<unknown>[])`](#removecomponentsentity-entity-components-componentunknown)
      - [`async run(...args: any[]): Promise<void>`](#async-runargs-any-promisevoid)
      - [`subscribe(components: Component<unknown>[], callback: QueryCallback, emit?: boolean): Function`](#subscribecomponents-componentunknown-callback-querycallback-emit-boolean-function)
      - [`makeSubscription(components: IComponent<unknown>[], emit?: boolean): (cb: QueryCallback) => () => void`](#makesubscriptioncomponents-icomponentunknown-emit-boolean-cb-querycallback----void)
      - [`unsubscribe(components: Component<unknown>[], callback: QueryCallback)`](#unsubscribecomponents-componentunknown-callback-querycallback)
      - [`updateComponent<T>(entity: Entity, Component, update: any | ComponentUpdater<T>)`](#updatecomponenttentity-entity-component-update-any--componentupdatert)
    - [`Component<T>`](#componentt)
    - [`ID`](#id)
    - [`getID(entity: Entity): string`](#getidentity-entity-string)
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
import { World, ID, Component, getComponent } from 'wecs'

// instantiate the world
const world = new World()

// create a component
class Movable {} // Functions as a tag
class Velocity extends Component<{ val: number }> { } // Use a shorthand generic base class

class Position { // use your own class
  val: number
  constructor(pos) {
    this.val = pos
  }
}

// create a system that is called with entities every time world.run is called
function System(entities) {
  entities.forEach(e => {
    world.updateComponent(e, Position, c => {
      c.val += getComponent(e, Velocity).val
    })
  })
}

// register the System to receive entities with both position and velocity components
world.register(
  System,
  [
    Movable,
    Position,
    Velocity
  ]
)

// create an entity, this one can move, has a position, and a velocity
world.createEntity([
  [ID, { id: 'foo' }],
  [Movable],
  [Position, 0],
  [Velocity, { val: 2 }]
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

#### `query(components: Component<unknown>[], persist?: Boolean): Entity[]`

Query all entities that meet the component criteria, optionally saving the query for faster retrieval later.

```js
const entities = world.query([Position, Velocity], true)
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

#### `makeSubscription(components: IComponent<unknown>[], emit?: boolean): (cb: QueryCallback) => () => void`

Instead of taking a callback, create a factory function that can be used to create subscriptions. Returns a function that expects a single callback function as an argument that plays nicely with other reactive frameworks.

```js
//Kefir/Rx
var stream = Kefir.fromCallback(world.makeSubscription([Position, Velocity], true));

// svelte
function useEntities(components) {
  return {
    subscribe: world.makeSubscription(components, true)
  }
}
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

#### `updateComponent<T>(entity: Entity, Component, update: any | ComponentUpdater<T>): `

Takes an entity, a component, and a either callback function that is called with value of the entity's component, or a new value for the component.

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

// reset the value
world.updateComponent(e, Component, new Component(3))
```

### `Component<T>`

The exported `Component` class is a generic class that expects to be constructed with an object of shape `T`, and assigns properties of the object `T` to its context.

`Component` is mainly a convenient shorthand to build typed, easily serializable components.

```js
import { Component } from 'wecs'

class Position extends Component<{ x: number, y: number }> { }

const p = new Position({ x: 0, y: 0 })
console.assert(p.x === 0)
console.assert(p.y === 0)

// You can easily serialize and reconstruct components this way
console.assert(p.x === new Position(JSON.parse(JSON.stringify(p))).x)
```

### `ID`

It's common practice when using ECS to uniquely identify your entities. The exported `ID` class extends `Component` and has elevated component privileges. Every entity is given an ID component, and ID components can not be removed from entities, but ID components can be updated.

```js
// Entities created without an ID component will use the current timestamp in MS
const entity = world.createEntity([Component])

// Creating an entity with a custom ID component is fine too
const entity = world.createEntity([
  [ID, { id: 'foo' }]
])
getID(entity) === 'foo'
```

### `getID(entity: Entity): string`

Retrieves a given entity's unique identifier from its `ID` component.

```js
const entity = world.createEntity([
  [ID, { id: 'foo' }]
])
getID(entity) === 'foo'
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
