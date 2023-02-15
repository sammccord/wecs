export type ID = number | string | bigint

export type With<T, K extends keyof T> = Required<Pick<T, K>>
export type Without<E, P extends keyof E> = Omit<E, P>

export type Component<E> = keyof E
export type ComponentUpdater<T> = T | ((value: T) => T)
export type ComponentUpdaters<E, C extends keyof E> = [
  C,
  ComponentUpdater<E[C]>
]
export type ComponentUpdate<E, C extends keyof E> = [C, E[C]]

export interface BaseEntity {
  id: ID | undefined
}

export type EntitiesCallback<Entity> = (entities: Set<Entity>) => any
export type EntityCallback<Entity> = (entity: Entity) => any
export type EntityUpdateCallback<Entity> = (
  entity: Entity,
  updates?: ComponentUpdate<Entity, Component<Entity>>[]
) => any

interface Query<Entity extends object, C extends keyof Entity> {
  components: C[]
  exclude?: C[]
  entities: Set<With<Entity, C>>
  subscriptions: Set<EntitiesCallback<With<Entity, C>>>
  updates: Set<EntityUpdateCallback<With<Entity, C>>>
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

let _id = 0
export function generateId() {
  return (_id += 1)
}

export function makeQueryKey<
  Entity extends object,
  C extends Component<Entity>
>(components: C[]): string {
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

  protected _entities: Map<ID, Entity> = new Map()

  protected systems: [Function, Set<Entity>][] = []
  protected queries: Map<string, Query<Entity, Component<Entity>>> = new Map()

  protected _onCreate = new Set<EntityCallback<Entity>>()
  protected _onUpdate = new Set<EntityUpdateCallback<Entity>>()
  protected _onRemove = new Set<EntityCallback<Entity>>()

  public get size() {
    return this._entities.size
  }

  public get entities() {
    return this._entities.values()
  }

  constructor(config?: Partial<Config<Entity>>) {
    this.config = { ...this.config, ...config }

    // React to creation and add to queries
    this._onCreate.add((entity: any) => {
      this.queries.forEach((query) => {
        if (query.exclude && hasSomeComponents(entity, query.exclude)) return
        if (hasComponents(entity, query.components)) {
          query.entities.add(entity)
          query.subscriptions.forEach(async (sub) => {
            sub(query.entities)
          })
        }
      })
    })

    // React to added/removed components and trigger subscriptions
    this._onUpdate.add((entity) => {
      this.queries.forEach((query) => {
        let executeSubs = false
        // should be removed?
        if (query.entities.has(entity as any)) {
          executeSubs = true
          if (query.exclude && hasSomeComponents(entity, query.exclude)) {
            query.entities.delete(entity as any)
          }
        } else {
          // should be added?
          if (query.exclude && hasSomeComponents(entity, query.exclude)) {
          } else if (hasComponents(entity, query.components)) {
            executeSubs = true
            query.entities.add(entity as any)
          }
        }
        if (executeSubs)
          query.subscriptions.forEach(async (cb) => cb(query.entities))
      })
    })

    // React to individual entity updates
    this._onUpdate.add((entity, updates) => {
      if (!updates) return
      this.queries.forEach((query) => {
        query.updates.forEach(async (cb) => cb(entity as any, updates))
      })
    })

    this._onUpdate.add((entity) => {
      if (
        Object.keys(entity).length === 0 ||
        ((entity as any).id && Object.keys(entity).length === 1)
      ) {
        this.remove(entity)
      }
    })

    this._onRemove.add((entity) => {
      this.queries.forEach((query) => {
        if (query.entities.delete(entity as any)) {
          query.subscriptions.forEach(async (sub) => {
            sub(query.entities)
          })
        }
      })
    })
  }

  protected queryWithKey<C extends Component<Entity>>(
    key: string,
    components: C[],
    opts: {
      exclude?: C[]
      persist?: Boolean
    } = {}
  ): Set<With<Entity, C>> {
    const query = this.queries.get(key)
    if (query) return query.entities

    const entities = new Set<Entity>()
    for (const entity of this._entities.values()) {
      if (opts.exclude && hasSomeComponents(entity, opts.exclude)) continue
      if (hasComponents(entity, components)) entities.add(entity)
    }
    if (opts.persist)
      this.queries.set(key, {
        components,
        entities: entities as Set<Required<Pick<Entity, keyof Entity>>>,
        exclude: opts.exclude,
        subscriptions: new Set(),
        updates: new Set(),
      })

    return entities as unknown as Set<Required<Pick<Entity, C>>>
  }

  public get<C extends Component<Entity> = any>(
    id: ID
  ): With<Entity, C> | undefined {
    return this._entities.get(id) as any as With<Entity, C>
  }

  public add = this.create.bind(this)
  public create(entity: Entity): Entity {
    this._entities.set(
      this.config.getId(entity) ||
        ((entity as any).id = this.config.generateId()),
      entity
    )
    this._onCreate.forEach(async (cb) => cb(entity))
    return entity
  }

  public remove(entity: Entity): Entity {
    this._handleRemoveCallbacks(entity)
    return entity
  }

  public clear() {
    for (let query of this.queries.values()) {
      query.entities.clear()
    }
    this._entities.clear()
  }

  public query<C extends Component<Entity>>(
    components: C[],
    opts: {
      exclude?: Component<Entity>[]
      persist?: Boolean
    } = {}
  ): Set<With<Entity, C>> {
    return this.queryWithKey(
      makeQueryKey<Entity, C>(components),
      components,
      opts
    )
  }

  public register<C extends Component<Entity>>(
    system: Function,
    components: C[],
    exclude?: Component<Entity>[]
  ): void {
    this.systems.push([
      system,
      this.queryWithKey(makeQueryKey<Entity, C>(components), components, {
        exclude,
        persist: true,
      }),
    ])
  }

  public addComponents(entity: Entity, components: Partial<Entity>) {
    Object.assign(entity, components)
    this._handleUpdateCallbacks(
      entity,
      Object.entries(components) as ComponentUpdate<Entity, Component<Entity>>[]
    )
  }

  public removeComponents<C extends Component<Entity>>(
    entity: Entity,
    components: C[] = []
  ) {
    if (!components.length) return
    this._handleUpdateCallbacks(
      entity,
      components.map((c) => {
        delete entity[c]
        return [c, undefined]
      }) as ComponentUpdate<Entity, C>[]
    )
  }

  public async run<Args extends readonly any[]>(...args: Args): Promise<void> {
    if (this.config.onBefore) await this.config.onBefore(...args)
    if (this.config.parallel) {
      await Promise.all(
        this.systems.map(async ([system, entities]) => {
          if (args) await system(...args, entities)
          else await system(entities)
        })
      )
    } else {
      for (let [system, entities] of this.systems) {
        if (args) system(...args, entities)
        else system(entities)
      }
    }
    if (this.config.onAfter) await this.config.onAfter(...args)
  }

  public subscribe<C extends Component<Entity>>(
    components: C[],
    callback: EntitiesCallback<With<Entity, C>>,
    opts: { emit?: boolean; exclude?: Component<Entity>[] } = {}
  ): () => void {
    return this.makeSubscription(components, opts)(callback)
  }

  public makeSubscription<C extends Component<Entity>>(
    components: C[],
    opts: { emit?: boolean; exclude?: Component<Entity>[] } = {}
  ): (cb: EntitiesCallback<With<Entity, C>>) => () => void {
    const key = makeQueryKey<Entity, C>(components)
    return (callback) => {
      let query = this.queries.get(key)
      if (query) {
        this.queries.get(key)?.subscriptions.add(callback)
      } else {
        query = {
          components,
          entities: this.queryWithKey(key, components) as any,
          subscriptions: new Set([callback]),
          updates: new Set(),
        }
        this.queries.set(key, query)
      }

      if (opts.emit)
        callback(query.entities || this.queryWithKey(key, components))
      return () => {
        query?.subscriptions.delete(callback)
      }
    }
  }

  public onEntityCreated(cb: EntityCallback<Entity>): () => void {
    this._onCreate.add(cb as any)
    return () => this._onCreate.delete(cb as any)
  }

  public onEntityUpdated(cb: EntityCallback<Entity>): () => void {
    this._onUpdate.add(cb as any)
    return () => this._onUpdate.delete(cb as any)
  }

  public onEntityRemoved(cb: EntityCallback<Entity>): () => void {
    this._onRemove.add(cb as any)
    return () => this._onRemove.delete(cb as any)
  }

  public onUpdate<C extends Component<Entity>>(
    components: C[],
    cb: EntityUpdateCallback<With<Entity, C>>
  ): () => void {
    return this.makeUpdateHandler(components)(cb as any)
  }

  public makeUpdateHandler<C extends Component<Entity>>(
    components: C[]
  ): (cb: EntityUpdateCallback<With<Entity, C>>) => () => void {
    const key = makeQueryKey<Entity, C>(components)
    return (callback) => {
      let query = this.queries.get(key) as any as Query<Entity, C>
      if (query) {
        query.updates.add(callback as any)
      } else {
        query = {
          components,
          entities: this.queryWithKey(key, components) as any,
          subscriptions: new Set(),
          updates: new Set([callback]),
        } as Query<Entity, C>
        this.queries.set(key, query as any)
      }
      return () => {
        query?.updates.delete(callback as any)
      }
    }
  }

  public unsubscribe<C extends Component<Entity>>(
    components: C[],
    callback: EntitiesCallback<With<Entity, C>>
  ): void {
    const key = makeQueryKey<Entity, C>(components)
    this.queries.get(key)?.subscriptions.delete(callback)
  }

  public unsubscribeUpdate<C extends Component<Entity>>(
    components: C[],
    callback: EntityUpdateCallback<With<Entity, C>>
  ): void {
    this.queries
      .get(makeQueryKey<Entity, C>(components))
      ?.updates.delete(callback as any)
  }

  public update(entity: Entity, components: Partial<Entity>): Entity {
    Object.assign(entity, components)
    this._handleUpdates(
      entity,
      Object.entries(components) as ComponentUpdate<Entity, Component<Entity>>[]
    )
    return entity
  }

  public updateComponent<C extends Component<Entity>>(
    entity: Entity,
    component: C,
    update: ComponentUpdater<Entity[C]>
  ): Entity[C] {
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

  private _update<C extends Component<Entity>>(
    entity: Entity,
    component: C,
    update: ComponentUpdater<Entity[C]>
  ): Entity[C] {
    entity[component] =
      typeof update === 'function'
        ? (update as any)(entity[component]) || entity[component]
        : update
    return entity[component]
  }

  private _handleUpdates<C extends keyof Entity>(
    entity: Entity,
    updates: ComponentUpdate<Entity, C>[]
  ) {
    if (this.config.asyncUpdates)
      setTimeout(() => this._handleUpdateCallbacks(entity, updates), 0)
    else this._handleUpdateCallbacks(entity, updates)
  }

  private _handleUpdateCallbacks(
    e: Entity,
    updates?: ComponentUpdate<Entity, keyof Entity>[]
  ) {
    this._onUpdate.forEach(async (cb) => cb(e, updates))
  }

  private _handleRemoveCallbacks(entity: Entity) {
    this._onRemove.forEach(async (cb) => cb(entity))
    this._entities.delete(this.config.getId(entity))
  }
}
