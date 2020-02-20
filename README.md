# wecs

![](https://img.badgesize.io/sammccord/wecs/master/dist/index.umd.js.svg)
![](https://img.badgesize.io/sammccord/wecs/master/dist/index.umd.js.svg?compression=gzip)

> A **wee (small)** Entity Component System for Javascript. 0 deps, <1k gzipped

- [wecs](#wecs)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [API](#api)
    - [`World`](#world)
      - [`constructor(config: Config = {})`](#constructorconfig-config)
      - [`register(system: Function, ...components: Component<unknown>[]): void`](#registersystem-function-components-componentunknown-void)
      - [`query(...components: Component<unknown>[]): Entity[]`](#querycomponents-componentunknown-entity)
      - [`subscribe(components: Component<unknown>[], callback: QueryCallback, emit: boolean = false): Function`](#subscribecomponents-componentunknown-callback-querycallback-emit-boolean--false-function)
      - [`unsubscribe(components: Component<unknown>[], callback: QueryCallback): void`](#unsubscribecomponents-componentunknown-callback-querycallback-void)
      - [`createEntity(...components: [Component<unknown>, ...any[]][]): Entity`](#createentitycomponents-componentunknown-any-entity)
      - [`addComponent(entity: Entity, ...components: [Component<unknown>, ...any[]][])`](#addcomponententity-entity-components-componentunknown-any)
      - [`removeComponent(entity: Entity, ...components: Component<unknown>[])`](#removecomponententity-entity-components-componentunknown)
      - [`async run(...args: any[]): Promise<void>`](#async-runargs-any-promisevoid)
    - [`getComponent<T>(entity: Entity, Component: Component<T>): T`](#getcomponenttentity-entity-component-componentt-t)
    - [`hasComponent(entity: Entity, ...components: Component<unknown>[])`](#hascomponententity-entity-components-componentunknown)

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
  Position,
  Velocity
)

// create an entity
world.createEntity(
  [Position, 0],
  [Velocity, 2]
)

// execute all systems in parallel
world.run()

```

## API

### `World`

`World` is the default export class containing entities 

#### `constructor(config: Config = {})`

You can construct `World` with the following config shape. All properties are optional.

|Key|Type|Description|
|-|-|-|
|`parallel`|`boolean`|Run all systems in parallel|
|`onBefore`|`(...args: any[]) => Promise<void>`|A function called with an optional message before all systems are run.`|
|`onAfter`|`(...args: any[]) => Promise<void>`|A function called with an optional message after all systems are run.`|

#### `register(system: Function, ...components: Component<unknown>[]): void`

Register a system function to be called with entities that meet all of the component criteria:

```js
function Component() {
  this.foo = 'bar'
  return this
}

function System(entities) {
  entities.forEach(e => e.Component.foo = 'baz')
}

world.register(System, Component, OtherComponent, ThirdComponent)
```

#### `query(...components: Component<unknown>[]): Entity[]`

Query all entities that meet the component criteria

```js
const entities = world.query(Position, Velocity)
```

#### `subscribe(components: Component<unknown>[], callback: QueryCallback, emit: boolean = false): Function`

Subscribe to updates with a callback function that gets executed when:
  * a new entity meeting the component criteria gets created
  * an entity gets a new component that meets the criteria
  * an entity has a component removed that makes it no longer meet the criteria
  * after the systems run and components are presumably mutated

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

#### `unsubscribe(components: Component<unknown>[], callback: QueryCallback): void`

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

#### `createEntity(...components: [Component<unknown>, ...any[]][]): Entity`

Creates an entity with the provided Components and values.

```js
function Position(number, foo) {
  console.assert(number === 0)
  console.assert(foo === 'foo')
  return this
}

class Velocity {
  constructor(number, bar) {
    console.assert(number === 2)
    console.assert(foo === 'bar')
  }
}


const entity = world.createEntity(
  [Position, 0, 'foo'],
  [Velocity, 2, 'bar']
)
```

#### `addComponent(entity: Entity, ...components: [Component<unknown>, ...any[]][])`

Adds components to a given entity

```js

world.addComponent(
  e,
  [Position, 0, 'foo'],
  [Velocity, 2, 'bar']
)
```

#### `removeComponent(entity: Entity, ...components: Component<unknown>[])`

Removes components from a given entity

```js

world.removeComponent(
  e,
  Position,
  Velocity
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

### `getComponent<T>(entity: Entity, Component: Component<T>): T`

Given an entity, gets the given component or null if the entity doesn't have it.

```js
import { getComponent } from 'wecs'

const entity = world.createEntity(
  [Position, 0],
  [Velocity, 2]
)

const position = getComponent(entity, Position)
```

### `hasComponent(entity: Entity, ...components: Component<unknown>[])`

Given an entity, gets the given component or null if the entity doesn't have it.

```js
import { hasComponent } from 'wecs'

const entity = world.createEntity(
  [Position, 0],
  [Velocity, 2]
)

console.assert(hasComponent(entity, Position, Velocity))
```
