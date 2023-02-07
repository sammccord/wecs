export type ID = number | string | bigint

export type Component<E> = keyof E
export type ComponentUpdater<T> = T | ((value: T) => T | void)
export type ComponentUpdaters<E, C extends keyof E> = [
  C,
  ComponentUpdater<E[C]>
]
export type ComponentUpdate<E, C extends keyof E> = [C, E[C]]

export interface BaseEntity {
  id: ID | undefined
}

export type EntitiesCallback<Entity> = (entities: Set<Entity>) => void
export type ChangeCallback<Entity> = (
  entity: Entity,
  updates: ComponentUpdate<Entity, Component<Entity>>[]
) => void

interface Query<Entity extends {} = any> {
  components: (keyof Entity)[]
  exclude?: (keyof Entity)[]
  entities: Set<Entity>
  subscriptions: Set<EntitiesCallback<Entity>>
  changeHandlers: Set<ChangeCallback<Entity>>
}

export interface Config<Entity> {
  getId: (e: Entity) => ID
  parallel: boolean
  asyncUpdates: boolean
  generateId: () => ID
  onBefore: (...args: any[]) => void | Promise<void>
  onAfter: (...args: any[]) => void | Promise<void>
}

export function getComponent<Entity extends {}, C extends keyof Entity>(
  entity: Entity,
  component: C
): Entity[C] {
  return entity[component]
}

export function hasComponent<Entity extends {} = any>(
  entity: Entity,
  component: Component<Entity>
) {
  return entity[component] !== undefined
}

export function hasSomeComponents<Entity extends {} = any>(
  entity: Entity,
  components: (keyof Entity)[]
): boolean {
  return components.some((c) => entity[c] !== undefined)
}

export function hasComponents<Entity extends {} = any>(
  entity: Entity,
  components: (keyof Entity)[]
): boolean {
  return components.every((c) => entity[c] !== undefined)
}

export function generateId() {
  return crypto.randomUUID()
}

export function makeQueryKey<Entity extends {} = any>(
  components: (keyof Entity)[]
): string {
  return components.sort().join()
}

export class World<Entity extends {} = any> {
  protected config: Config<Entity> = {
    getId: (e: Entity) => (e as any).id,
    generateId,
    parallel: false,
    asyncUpdates: false,
    onBefore: () => undefined,
    onAfter: () => undefined,
  }
  protected systems: [Function, string][] = []
  protected _entities: Map<ID, Entity> = new Map()
  protected queries: Map<string, Query<Entity>> = new Map()

  public get size() {
    return this._entities.size
  }

  public get entities() {
    return [...this._entities.values()]
  }

  constructor(config?: Partial<Config<Entity>>) {
    this.config = { ...this.config, ...config }
  }

  protected queryWithKey(
    key: string,
    components: Component<Entity>[],
    opts: {
      exclude?: Component<Entity>[]
      persist?: Boolean
    } = {}
  ): Set<Entity> {
    if (this.queries.has(key)) return this.queries.get(key)!.entities
    const entities = new Set<Entity>()
    for (const entity of this._entities.values()) {
      if (opts.exclude && hasSomeComponents(entity, opts.exclude)) continue
      if (hasComponents(entity, components)) entities.add(entity)
    }
    if (opts.persist)
      this.queries.set(key, {
        components,
        entities,
        exclude: opts.exclude,
        subscriptions: new Set(),
        changeHandlers: new Set(),
      })

    return entities
  }

  private _handleAddCallbacks(e: Entity) {
    for (let query of this.queries.values()) {
      if (!query.entities.has(e)) {
        if (query.exclude && hasSomeComponents(e, query.exclude)) continue
        if (hasComponents(e, query.components)) {
          query.entities.add(e)
          for (let sub of query.subscriptions) {
            sub(query.entities)
          }
        }
      }
    }
  }

  private _handleRemoveCallbacks(entity: Entity, force = false) {
    for (let query of this.queries.values()) {
      if (query.entities.has(entity)) {
        if (query.exclude && hasSomeComponents(entity, query.exclude)) continue
        if (force || !hasComponents(entity, query.components)) {
          query.entities.delete(entity)
          for (let sub of query.subscriptions) {
            sub(query.entities)
          }
        }
      }
    }
    if (
      force ||
      Object.keys(entity).length === 0 ||
      ((entity as any).id && Object.keys(entity).length === 1)
    ) {
      this._entities.delete(this.config.getId(entity))
    }
  }

  public addComponents(entity: Entity, components: Partial<Entity>) {
    Object.assign(entity, components)
    this._handleAddCallbacks(entity)
  }

  public add = this.createEntity.bind(this)
  public createEntity(entity: Entity): Entity {
    const id =
      this.config.getId(entity) ||
      ((entity as any).id = this.config.generateId())
    this._entities.set(id, entity)

    for (let query of this.queries.values()) {
      if (query.exclude && hasSomeComponents(entity, query.exclude)) continue
      if (hasComponents(entity, query.components)) {
        query.entities.add(entity)
        for (let sub of query.subscriptions) {
          sub(query.entities)
        }
      }
    }
    return entity
  }

  public remove(entity: Entity): Entity {
    this._handleRemoveCallbacks(entity, true)
    return entity
  }

  public get(id: ID): Entity | undefined {
    return this._entities.get(id)
  }

  public clear() {
    this._entities.clear()
    for (let query of this.queries.values()) {
      query.entities.clear()
    }
    this.systems.length = 0
  }

  public query(
    components: Component<Entity>[],
    opts: {
      exclude?: Component<Entity>[]
      persist?: Boolean
    } = {}
  ): Set<Entity> {
    return this.queryWithKey(makeQueryKey(components), components, opts)
  }

  public register(
    system: Function,
    components: Component<Entity>[],
    exclude?: Component<Entity>[]
  ): void {
    const key = makeQueryKey(components)
    this.systems.push([system, key])
    this.queryWithKey(key, components, { exclude, persist: true })
  }

  public removeComponents(
    entity: Entity,
    components: Component<Entity>[] = []
  ) {
    if (!components.length) return
    for (let c of components) {
      delete entity[c]
    }
    this._handleRemoveCallbacks(entity)
  }

  public async run<Args extends readonly any[]>(...args: Args): Promise<void> {
    if (this.config.onBefore) await this.config.onBefore(...args)
    if (this.config.parallel) {
      await Promise.all(
        this.systems.map(async ([system, key]) => {
          if (args) await system(...args, this.queries.get(key)!.entities)
          else await system(this.queries.get(key)!.entities)
        })
      )
    } else {
      for (let [system, key] of this.systems) {
        if (args) system(...args, this.queries.get(key)!.entities)
        else system(this.queries.get(key)!.entities)
      }
    }
    if (this.config.onAfter) await this.config.onAfter(...args)
  }

  public subscribe(
    components: Component<Entity>[],
    callback: EntitiesCallback<Entity>,
    opts: { emit?: boolean; exclude?: Component<Entity>[] } = {}
  ): () => void {
    return this.makeSubscription(components, opts)(callback)
  }

  public makeSubscription(
    components: Component<Entity>[],
    opts: { emit?: boolean; exclude?: Component<Entity>[] } = {}
  ): (cb: EntitiesCallback<Entity>) => () => void {
    const key = makeQueryKey(components)
    return (callback) => {
      let entities: Set<Entity>
      if (this.queries.has(key)) {
        this.queries.get(key)?.subscriptions.add(callback)
      } else
        this.queries.set(key, {
          components,
          entities: (entities = this.queryWithKey(key, components)),
          subscriptions: new Set([callback]),
          changeHandlers: new Set(),
        })
      if (opts.emit) callback(entities! || this.queryWithKey(key, components))
      return () => {
        if (this.queries.has(key)) {
          this.queries.get(key)!.subscriptions.delete(callback)
        }
      }
    }
  }

  public handleChange(
    components: Component<Entity>[],
    callback: ChangeCallback<Entity>
  ): () => void {
    return this.makeChangeHandler(components)(callback)
  }

  public makeChangeHandler(
    components: Component<Entity>[]
  ): (cb: ChangeCallback<Entity>) => () => void {
    const key = makeQueryKey(components)
    return (callback) => {
      if (this.queries.has(key)) {
        this.queries.get(key)?.changeHandlers.add(callback)
      } else
        this.queries.set(key, {
          components,
          entities: this.queryWithKey(key, components),
          subscriptions: new Set(),
          changeHandlers: new Set([callback]),
        })
      return () => {
        if (this.queries.has(key)) {
          this.queries.get(key)!.changeHandlers.delete(callback)
        }
      }
    }
  }

  public unsubscribe(
    components: Component<Entity>[],
    callback: EntitiesCallback<Entity>
  ): void {
    const key = makeQueryKey(components)
    if (this.queries.has(key)) {
      this.queries.get(key)!.subscriptions.delete(callback)
    }
  }

  public unregisterHandler(
    components: Component<Entity>[],
    callback: ChangeCallback<Entity>
  ): void {
    const key = makeQueryKey(components)
    if (this.queries.has(key)) {
      this.queries.get(key)!.changeHandlers.delete(callback)
    }
  }

  public update(entity: Entity, components: Partial<Entity>): Entity {
    Object.assign(entity, components)
    this._handleUpdates(
      entity,
      Object.entries(components) as ComponentUpdate<Entity, Component<Entity>>[]
    )
    return entity
  }

  public updateComponent<T extends Component<Entity>>(
    entity: Entity,
    component: T,
    update: ComponentUpdater<Entity[T]>
  ): Entity[T] {
    const _update = this._update(entity, component, update)
    this._handleUpdates(entity, [[component, _update]])
    return _update
  }

  public updateComponents<C extends keyof Entity>(
    entity: Entity,
    updates: ComponentUpdaters<Entity, C>[]
  ): ComponentUpdate<Entity, C>[] {
    const _updates = updates.map(([component, update]) => [
      component,
      this._update(entity, component, update),
    ]) as ComponentUpdate<Entity, C>[]
    this._handleUpdates(entity, _updates)
    return _updates
  }

  private _update<T extends Component<Entity>>(
    entity: Entity,
    component: T,
    update: ComponentUpdater<Entity[T]>
  ): Entity[T] {
    return (entity[component] =
      typeof update === 'function'
        ? (update as any)(entity[component]) || entity[component]
        : update)
  }

  private _handleUpdates<C extends keyof Entity>(
    entity: Entity,
    updates: ComponentUpdate<Entity, C>[]
  ) {
    if (this.config.asyncUpdates)
      setTimeout(() => this._callUpdateHandlers(entity, updates), 0)
    else this._callUpdateHandlers(entity, updates)
  }

  private _callUpdateHandlers<C extends keyof Entity>(
    entity: Entity,
    updates: ComponentUpdate<Entity, C>[]
  ) {
    for (let query of this.queries.values()) {
      if (query.entities.has(entity)) {
        for (let fn of query.subscriptions) {
          fn(query.entities)
        }
        for (let fn of query.changeHandlers) {
          fn(entity, updates)
        }
      }
    }
  }
}
