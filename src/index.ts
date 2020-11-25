type Entity = { [componentName: string]: any }

export interface IComponent<T> {
  new (...args: any[]): T
}

export type EntitiesCallback = (entities: Entity[]) => void
export type ChangeCallback<T> = (
  entity: Entity,
  updates: ComponentUpdate<T>[]
) => void

export type ComponentUpdater<T> = (component: T) => T
export type ComponentUpdate<T> = [IComponent<T>, T | ComponentUpdater<T>]

class _Component<T> {
  protected _: T
  constructor(value: T) {
    this._ = value
  }
  public get(): T {
    return this._
  }
  public find<V>(key: string): V {
    return (this._ as any)[key]
  }
  public set(value: T): T {
    this._ = { ...this._, ...value }
    return this._
  }
}
export type Component<T> = _Component<T> & T
export const Component: new <T>(obj: T) => _Component<T> & T = _Component as any
export class ID extends Component<{ id: string }> {}

interface Query {
  components: IComponent<unknown>[]
  entities: Entity[]
  subscriptions: EntitiesCallback[]
  changeHandlers: ChangeCallback<any>[]
}

export interface Config {
  parallel?: boolean
  id?: () => string
  onBefore?: (...args: any[]) => Promise<void>
  onAfter?: (...args: any[]) => Promise<void>
}

export function getID(entity: Entity): string {
  return entity[ID.name]._.id
}

export function getComponent<T>(entity: Entity, Component: IComponent<T>): T {
  return entity[Component.name]
}

export function hasComponent<T>(entity: Entity, components: IComponent<T>) {
  return !!entity[components.name]
}

export function hasComponents(
  entity: Entity,
  components: IComponent<unknown>[]
) {
  return components.every(c => !!entity[c.name])
}

const ceil = 0x10000
function defaultIDGenerator() {
  return Math.floor((1 + Math.random()) * ceil)
    .toString(16)
    .substring(1)
}

export class World {
  protected config: Config = { id: defaultIDGenerator }
  protected systems: [Function, string][] = []
  protected entities: { [id: string]: Entity } = {}
  protected queries: { [key: string]: Query } = {}

  constructor(config?: Config) {
    this.config = { ...this.config, ...config }
  }

  protected makeQueryKey(components: IComponent<unknown>[]): string {
    return components
      .map(c => c.name)
      .sort()
      .join('-')
  }

  protected queryWithKey(
    key: string,
    components: IComponent<unknown>[],
    persist?: Boolean
  ): Entity[] {
    if (this.queries[key]) return this.queries[key].entities
    const entities = Object.values(this.entities).filter(e =>
      hasComponents(e, components)
    )
    if (persist)
      this.queries[key] = {
        components,
        entities,
        subscriptions: [],
        changeHandlers: []
      }
    return entities
  }

  private _handleAddCallbacks(e: Entity) {
    Object.values(this.queries).forEach(query => {
      if (!query.entities.includes(e)) {
        if (hasComponents(e, query.components)) {
          query.entities.push(e)
          query.subscriptions.forEach(fn => fn(query.entities))
        }
      }
    })
  }

  private _handleRemoveCallbacks(entity: Entity) {
    Object.values(this.queries).forEach(query => {
      if (!query.entities.includes(entity)) return
      if (!hasComponents(entity, query.components)) {
        query.entities.splice(query.entities.indexOf(entity), 1)
        query.subscriptions.forEach(fn => fn(query.entities))
      }
    })
    if (Object.keys(entity).length === 1) delete this.entities[getID(entity)]
  }

  public addComponent<T>(
    entity: Entity,
    Component: IComponent<T>,
    ...args: any[]
  ) {
    entity[Component.name] = new Component(...args)
    this._handleAddCallbacks(entity)
  }

  public addComponents(
    entity: Entity,
    components: [IComponent<unknown>, ...any[]][]
  ) {
    if (!~components.length) return
    components.forEach(([Constructor, ...args]) => {
      entity[Constructor.name] = new Constructor(...args)
    })
    this._handleAddCallbacks(entity)
  }

  public createEntity(components: [IComponent<unknown>, ...any[]][]): Entity {
    const entity: Entity = {}
    components.forEach(([Constructor, ...args]) => {
      entity[Constructor.name] = new Constructor(...args)
    })
    if (!entity[ID.name]) entity[ID.name] = new ID({ id: this.config.id!() })
    this.entities[getID(entity)] = entity
    Object.values(this.queries).forEach(query => {
      if (hasComponents(entity, query.components)) query.entities.push(entity)
      query.subscriptions.forEach(fn => fn(query.entities))
    })
    return entity
  }

  public get(id: string): Entity {
    return this.entities[id]
  }

  public query(components: IComponent<unknown>[], persist?: Boolean): Entity[] {
    const key = this.makeQueryKey(components)
    return this.queryWithKey(key, components, persist)
  }

  public register(system: Function, components: IComponent<unknown>[]): void {
    const key = this.makeQueryKey(components)
    this.systems.push([system, key])
    this.queries[key] = {
      components,
      entities: [],
      subscriptions: [],
      changeHandlers: []
    }
  }

  public removeComponent<T>(entity: Entity, component: IComponent<T>) {
    if (!component || component.name === ID.name) return
    delete entity[component.name]
    this._handleRemoveCallbacks(entity)
  }

  public removeComponents(entity: Entity, components: IComponent<unknown>[]) {
    if (!components || !~components.length) return
    components.forEach(component => {
      if (component.name === ID.name) return
      delete entity[component.name]
    })
    this._handleRemoveCallbacks(entity)
  }

  public async run(...args: any[]): Promise<void> {
    if (this.config.onBefore) await this.config.onBefore(...args)
    if (this.config.parallel) {
      this.systems.forEach(([system, queryKey]) => {
        if (args) system(...args, this.queries[queryKey].entities)
        else system(this.queries[queryKey].entities)
      })
    } else {
      for (let [system, queryKey] of this.systems) {
        if (args) await system(...args, this.queries[queryKey].entities)
        else await system(this.queries[queryKey].entities)
      }
    }
    if (this.config.onAfter) await this.config.onAfter(...args)
  }

  public subscribe(
    components: IComponent<unknown>[],
    callback: EntitiesCallback,
    emit?: boolean
  ): () => void {
    return this.makeSubscription(components, emit)(callback)
  }

  public makeSubscription(
    components: IComponent<unknown>[],
    emit?: boolean
  ): (cb: EntitiesCallback) => () => void {
    const key = this.makeQueryKey(components)
    return callback => {
      const entities = this.queryWithKey(key, components)
      if (!!this.queries[key]) this.queries[key].subscriptions.push(callback)
      else
        this.queries[key] = {
          components,
          entities,
          subscriptions: [callback],
          changeHandlers: []
        }
      if (emit) callback(entities)
      return () => {
        if (!!this.queries[key]) {
          this.queries[key].subscriptions.splice(
            this.queries[key].subscriptions.indexOf(callback),
            1
          )
        }
      }
    }
  }

  public handleChange(
    components: IComponent<unknown>[],
    callback: ChangeCallback<unknown>
  ): () => void {
    return this.makeChangeHandler(components)(callback)
  }

  public makeChangeHandler(
    components: IComponent<unknown>[]
  ): (cb: ChangeCallback<unknown>) => () => void {
    const key = this.makeQueryKey(components)
    return callback => {
      if (!!this.queries[key]) this.queries[key].changeHandlers.push(callback)
      else
        this.queries[key] = {
          components,
          entities: this.queryWithKey(key, components),
          subscriptions: [],
          changeHandlers: [callback]
        }
      return () => {
        if (!!this.queries[key]) {
          this.queries[key].changeHandlers.splice(
            this.queries[key].changeHandlers.indexOf(callback),
            1
          )
        }
      }
    }
  }

  public unsubscribe(
    components: IComponent<unknown>[],
    callback: EntitiesCallback
  ): void {
    const key = this.makeQueryKey(components)
    if (!!this.queries[key]) {
      this.queries[key].subscriptions.splice(
        this.queries[key].subscriptions.indexOf(callback),
        1
      )
    }
  }

  public deregisterHandler(
    components: IComponent<unknown>[],
    callback: ChangeCallback<unknown>
  ): void {
    const key = this.makeQueryKey(components)
    if (!!this.queries[key]) {
      this.queries[key].subscriptions.splice(
        this.queries[key].changeHandlers.indexOf(callback),
        1
      )
    }
  }

  public updateComponent<T>(
    entity: Entity,
    Component: IComponent<T>,
    update: any | ComponentUpdater<T>
  ): IComponent<T> {
    const _update = this._update(entity, Component, update)
    Object.values(this.queries).forEach(query => {
      if (query.entities.includes(entity)) {
        query.subscriptions.forEach(fn => fn(query.entities))
        query.changeHandlers.forEach(fn => fn(entity, [[Component, _update]]))
      }
    })
    return _update
  }

  public updateComponents(
    entity: Entity,
    updates: ComponentUpdate<any>[]
  ): [IComponent<unknown>, unknown][] {
    const _updates = updates.map(([Component, update]) => [
      Component,
      this._update(entity, Component, update)
    ]) as [IComponent<{}>, {}][]
    Object.values(this.queries).forEach(query => {
      if (query.entities.includes(entity)) {
        query.subscriptions.forEach(fn => fn(query.entities))
        query.changeHandlers.forEach(fn => fn(entity, _updates))
      }
    })
    return _updates
  }

  private _update<T>(
    entity: Entity,
    Component: IComponent<T>,
    update: any | ComponentUpdater<T>
  ): IComponent<T> {
    entity[Component.name] =
      typeof update === 'function'
        ? update(entity[Component.name]) || entity[Component.name]
        : update
    return entity[Component.name]
  }
}
