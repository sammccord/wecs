type Entity = { [componentName: string]: any }

interface IComponent<T> {
  new(...args: any): T
}

type QueryCallback = (entities: Entity[]) => void

type ComponentUpdater<T> = (component: T) => T

interface Query {
  components: IComponent<unknown>[],
  entities: Entity[]
  callbacks: QueryCallback[]
}

interface Config {
  parallel?: boolean
  onBefore?: (...args: any[]) => Promise<void>
  onAfter?: (...args: any[]) => Promise<void>
}

export function getID(entity: Entity): string {
  return entity[ID.name].id
}

export function getComponent<T>(entity: Entity, Component: IComponent<T>): T {
  return entity[Component.name]
}

export function hasComponent<T>(entity: Entity, components: IComponent<T>) {
  return !!entity[components.name]
}

export function hasComponents(entity: Entity, components: IComponent<unknown>[]) {
  return components.every(c => !!entity[c.name])
}

class _Component<T>  {
  constructor(obj = {}) {
    Object.assign(this, obj)
  }
}
type Component<T> = _Component<T> & T
export const Component: new <T>(obj: T) => _Component<T> & T = _Component as any;
export class ID extends Component<{ id: string }> { }

export class World {

  protected config: Config = {}

  private _systems: [Function, string][] = []
  private _entities: { [id: string]: Entity } = {}
  private _queries: { [key: string]: Query } = {}

  constructor(config: Config = {}) {
    this.config = config
  }

  protected makeQueryKey(components: IComponent<unknown>[]): string {
    return components.map(c => c.name).sort().join('-')
  }

  protected queryWithKey(key: string, components: IComponent<unknown>[], persist?: Boolean): Entity[] {
    if (this._queries[key]) return this._queries[key].entities
    const entities = Object.values(this._entities).filter(e => hasComponents(e, components))
    if (persist) this._queries[key] = { components, entities, callbacks: [] }
    return entities
  }

  private _handleAddCallbacks(e: Entity) {
    Object.values(this._queries).forEach(query => {
      if (!query.entities.includes(e)) {
        if (hasComponents(e, query.components)) {
          query.entities.push(e)
          query.callbacks.forEach(fn => fn(query.entities))
        }
      }
    })
  }

  private _handleRemoveCallbacks(entity: Entity) {
    Object.values(this._queries).forEach(query => {
      if (!query.entities.includes(entity)) return
      if (!hasComponents(entity, query.components)) {
        query.entities.splice(query.entities.indexOf(entity), 1)
        query.callbacks.forEach(fn => fn(query.entities))
      }
    })
    if (Object.keys(entity).length === 1) delete this._entities[entity.ID.id]
  }

  public addComponent<T>(entity: Entity, Component: IComponent<T>, ...args: any[]) {
    entity[Component.name] = new Component(...args)
    this._handleAddCallbacks(entity)
  }

  public addComponents(entity: Entity, components: [IComponent<unknown>, ...any[]][]) {
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
    if (!entity.ID) entity.ID = new ID({ id: String(new Date().valueOf()) })
    this._entities[entity.ID.id] = entity
    Object.values(this._queries).forEach(query => {
      if (hasComponents(entity, query.components)) query.entities.push(entity)
      query.callbacks.forEach(fn => fn(query.entities))
    })
    return entity
  }

  public get(id: string): Entity {
    return this._entities[id]
  }

  public query(components: IComponent<unknown>[], persist?: Boolean): Entity[] {
    const key = this.makeQueryKey(components)
    return this.queryWithKey(key, components, persist)
  }

  public register(system: Function, components: IComponent<unknown>[]): void {
    const key = this.makeQueryKey(components)
    this._systems.push([system, key])
    this._queries[key] = { components, entities: [], callbacks: [] }
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
      this._systems.forEach(([system, queryKey]) => {
        if (args) system(...args, this._queries[queryKey].entities)
        else system(this._queries[queryKey].entities)
      })
    } else {
      for (let [system, queryKey] of this._systems) {
        if (args) await system(...args, this._queries[queryKey].entities)
        else await system(this._queries[queryKey].entities)
      }
    }
    if (this.config.onAfter) await this.config.onAfter(...args)
  }

  public subscribe(components: IComponent<unknown>[], callback: QueryCallback, emit?: boolean): Function {
    const key = this.makeQueryKey(components)
    const entities = this.queryWithKey(key, components)
    if (!!this._queries[key]) this._queries[key].callbacks.push(callback)
    else this._queries[key] = {
      components,
      entities,
      callbacks: [callback]
    }
    if (emit) callback(entities)
    return () => {
      if (!!this._queries[key]) {
        this._queries[key].callbacks.splice(this._queries[key].callbacks.indexOf(callback), 1)
      }
    }
  }

  public unsubscribe(components: IComponent<unknown>[], callback: QueryCallback): void {
    const key = this.makeQueryKey(components)
    if (!!this._queries[key]) {
      this._queries[key].callbacks.splice(this._queries[key].callbacks.indexOf(callback), 1)
    }
  }

  public updateComponent<T>(entity: Entity, Component: IComponent<T>, update: any | ComponentUpdater<T>): void {
    entity[Component.name] = typeof update === 'function' ? update(entity[Component.name]) || entity[Component.name] : update
    Object.values(this._queries).forEach(query => {
      if (query.entities.includes(entity)) {
        query.callbacks.forEach(fn => fn(query.entities))
      }
    })
  }
}
