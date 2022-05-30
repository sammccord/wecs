export interface IComponent<T = any> {
  new (...args: any[]): T
}
export type ComponentUpdater<T> = (value: T) => T | void
export type ComponentUpdate<T> = [IComponent<T>, T]

export class Component<T> {
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
export class ID extends Component<{ id: string | number }> {}

export interface BaseEntity {
  ID: ID
}

export type Entity<Components = any> = BaseEntity & {
  [componentName: string]: Components
}

export type EntitiesCallback<Components> = (
  entities: Entity<Components>[]
) => void
export type ChangeCallback<Components> = (
  entity: Entity<Components>,
  updates: ComponentUpdate<Components>[]
) => void

interface Query<Components> {
  components: IComponent<Components>[]
  entities: Entity<Components>[]
  subscriptions: EntitiesCallback<Components>[]
  changeHandlers: ChangeCallback<Components>[]
}

export interface Config {
  parallel?: boolean
  id?: () => string
  onBefore?: (...args: any[]) => Promise<void>
  onAfter?: (...args: any[]) => Promise<void>
}

export function getID<Components>(entity: Entity<Components>): string {
  return (entity[ID.name] as any)._.id
}

export function getComponent<Component>(
  entity: Entity<Component>,
  component: IComponent<Component>
): Component {
  return entity[component.name]
}

export function hasComponent<Component>(
  entity: Entity,
  components: IComponent<Component>
) {
  return !!entity[components.name]
}

export function hasComponents<Components>(
  entity: Entity,
  components: IComponent<Components>[]
) {
  return components.every((c) => !!entity[c.name])
}

const ceil = 0x10000
function defaultIDGenerator() {
  return Math.floor((1 + Math.random()) * ceil)
    .toString(16)
    .substring(1)
}

export function makeQueryKey(components: IComponent[]): string {
  return components
    .map((c) => c.name)
    .sort()
    .join('-')
}

export class World {
  protected config: Config = { id: defaultIDGenerator }
  protected systems: [Function, string][] = []
  protected entities: { [id: string]: Entity<unknown> } = {}
  protected queries: { [key: string]: Query<unknown> } = {}

  constructor(config?: Config) {
    this.config = { ...this.config, ...config }
  }

  protected queryWithKey<Components>(
    key: string,
    components: IComponent<Components>[],
    persist?: Boolean
  ): Entity<Components>[] {
    if (this.queries[key])
      return (this.queries[key] as Query<Components>).entities
    const entities = Object.values(this.entities).filter((e) =>
      hasComponents(e, components)
    )
    if (persist)
      this.queries[key] = {
        components,
        entities,
        subscriptions: [],
        changeHandlers: [],
      }
    return entities as Entity<Components>[]
  }

  private _handleAddCallbacks(e: Entity) {
    Object.values(this.queries).forEach((query) => {
      if (!query.entities.includes(e)) {
        if (hasComponents(e, query.components)) {
          query.entities.push(e)
          query.subscriptions.forEach((fn) => fn(query.entities))
        }
      }
    })
  }

  private _handleRemoveCallbacks(entity: Entity) {
    Object.values(this.queries).forEach((query) => {
      if (!query.entities.includes(entity)) return
      if (!hasComponents(entity, query.components)) {
        query.entities.splice(query.entities.indexOf(entity), 1)
        query.subscriptions.forEach((fn) => fn(query.entities))
      }
    })
    if (Object.keys(entity).length === 1) delete this.entities[getID(entity)]
  }

  public addComponent<Component>(
    entity: Entity<Component>,
    component: IComponent<Component>,
    ...args: any[]
  ) {
    entity[component.name] = new component(...args)
    this._handleAddCallbacks(entity)
  }

  public addComponents<Components>(
    entity: Entity<Components>,
    components: [IComponent<Components>, ...any[]][]
  ) {
    if (!components.length) return
    components.forEach(([component, ...args]) => {
      entity[component.name] = new component(...args)
    })
    this._handleAddCallbacks(entity)
  }

  public createEntity<Components>(
    components: [IComponent<Components>, ...any[]][]
  ): Entity<Components> {
    const entity: any = {}
    components.forEach(([Constructor, ...args]) => {
      entity[Constructor.name] = new Constructor(...args)
    })
    if (!entity[ID.name]) entity[ID.name] = new ID({ id: this.config.id!() })
    this.entities[getID(entity)] = entity
    Object.values(this.queries).forEach((query) => {
      if (hasComponents(entity, query.components)) query.entities.push(entity)
      query.subscriptions.forEach((fn) => fn(query.entities))
    })
    return entity as Entity<Components>
  }

  public get<Components>(id: string): Entity<Components> {
    return this.entities[id] as unknown as Entity<Components>
  }

  public query<Components>(
    components: IComponent[],
    cache?: Boolean
  ): Entity<Components>[] {
    const key = makeQueryKey(components)
    return this.queryWithKey(key, components, cache)
  }

  public register(system: Function, components: IComponent[]): void {
    const key = makeQueryKey(components)
    this.systems.push([system, key])
    this.queries[key] = {
      components,
      entities: [],
      subscriptions: [],
      changeHandlers: [],
    }
  }

  public removeComponent(entity: Entity, component: IComponent) {
    if (!component || component.name === ID.name) return
    delete entity[component.name]
    this._handleRemoveCallbacks(entity)
  }

  public removeComponents(entity: Entity, components: IComponent[]) {
    if (!components || !components.length) return
    components.forEach((component) => {
      if (component.name === ID.name) return
      delete entity[component.name]
    })
    this._handleRemoveCallbacks(entity)
  }

  public async run<Args extends readonly any[]>(...args: Args): Promise<void> {
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

  public subscribe<Components>(
    components: IComponent<Components>[],
    callback: EntitiesCallback<Components>,
    emit?: boolean
  ): () => void {
    return this.makeSubscription<Components>(components, emit)(callback)
  }

  public makeSubscription<Components>(
    components: IComponent<Components>[],
    emit?: boolean
  ): (cb: EntitiesCallback<Components>) => () => void {
    const key = makeQueryKey(components)
    return (callback) => {
      const entities = this.queryWithKey<Components>(key, components)
      if (!!this.queries[key])
        (
          this.queries[key].subscriptions as EntitiesCallback<Components>[]
        ).push(callback)
      else
        this.queries[key] = {
          components,
          entities,
          subscriptions: [callback as any],
          changeHandlers: [],
        }
      if (emit) callback(entities)
      return () => {
        if (!!this.queries[key]) {
          this.queries[key].subscriptions.splice(
            (
              this.queries[key].subscriptions as EntitiesCallback<Components>[]
            ).indexOf(callback),
            1
          )
        }
      }
    }
  }

  public handleChange<Components>(
    components: IComponent<Components>[],
    callback: ChangeCallback<Components>
  ): () => void {
    return this.makeChangeHandler(components)(callback)
  }

  public makeChangeHandler<Components>(
    components: IComponent<Components>[]
  ): (cb: ChangeCallback<Components>) => () => void {
    const key = makeQueryKey(components)
    return (callback) => {
      if (!!this.queries[key])
        (this.queries[key].changeHandlers as ChangeCallback<Components>[]).push(
          callback
        )
      else
        this.queries[key] = {
          components,
          entities: this.queryWithKey(key, components),
          subscriptions: [],
          changeHandlers: [callback as any],
        }
      return () => {
        if (!!this.queries[key]) {
          this.queries[key].changeHandlers.splice(
            (
              this.queries[key].changeHandlers as ChangeCallback<Components>[]
            ).indexOf(callback),
            1
          )
        }
      }
    }
  }

  public unsubscribe<Components>(
    components: IComponent[],
    callback: EntitiesCallback<Components>
  ): void {
    const key = makeQueryKey(components)
    if (!!this.queries[key]) {
      this.queries[key].subscriptions.splice(
        this.queries[key].subscriptions.indexOf(callback as any),
        1
      )
    }
  }

  public deregisterHandler<Components>(
    components: IComponent[],
    callback: ChangeCallback<Components>
  ): void {
    const key = makeQueryKey(components)
    if (!!this.queries[key]) {
      this.queries[key].subscriptions.splice(
        this.queries[key].changeHandlers.indexOf(callback as any),
        1
      )
    }
  }

  public updateComponent<Component>(
    entity: Entity<Component>,
    Component: IComponent<Component>,
    update: Component | ComponentUpdater<Component>
  ): Component {
    const _update = this._update(entity, Component, update)
    Object.values(this.queries).forEach((query) => {
      if (query.entities.includes(entity)) {
        query.subscriptions.forEach((fn) => fn(query.entities))
        query.changeHandlers.forEach((fn) => fn(entity, [[Component, _update]]))
      }
    })
    return _update
  }

  public updateComponents<Components>(
    entity: Entity<Components>,
    updates: [
      IComponent<Components>,
      Components | ComponentUpdater<Components>
    ][]
  ): [IComponent<Components>, Components][] {
    const _updates = updates.map(([Component, update]) => [
      Component,
      this._update(entity, Component, update),
    ]) as [IComponent<Components>, Components][]
    Object.values(this.queries).forEach((query) => {
      if (query.entities.includes(entity)) {
        query.subscriptions.forEach((fn) => fn(query.entities))
        query.changeHandlers.forEach((fn) => fn(entity, _updates))
      }
    })
    return _updates
  }

  private _update<Component>(
    entity: Entity<Component>,
    component: IComponent,
    update: Component | ComponentUpdater<Component>
  ): Component {
    return (entity[component.name] =
      typeof update === 'function'
        ? (update as ComponentUpdater<Component>)(entity[component.name]) ||
          entity[component.name]
        : update)
  }
}
