type Entity = {}

interface ClassComponent<T> {
  new(...args: any): T
  name: string
}

type FunctionComponent<T> = (...args: any[]) => T

type Component<T> = ClassComponent<T> | FunctionComponent<T>

type QueryCallback = (...entities: Entity[]) => void

interface Query {
  components: Component<unknown>[],
  entities: Entity[]
  callbacks: QueryCallback[]
}

interface Config {
  parallel?: boolean
  onBefore?: (...args: any[]) => Promise<void>
  onAfter?: (...args: any[]) => Promise<void>
}

export function getComponent<T>(entity: Entity, Component: Component<T>): T {
  return entity[Component.name]
}

export function hasComponent(entity: Entity, ...components: Component<unknown>[]) {
  return components.every(c => !!entity[c.name])
}

export default class World {

  protected config: Config = {}

  private _systems: [Function, string][] = []
  private _entities: Entity[] = []
  private _queries: { [key: string]: Query } = {}

  constructor(config: Config = {}) {
    this.config = config
  }

  protected makeQueryKey(...components: Component<unknown>[]): string {
    return components.map(c => c.name).sort().join('-')
  }

  protected queryWithKey(key, ...components: Component<unknown>[]): Entity[] {
    if (this._queries[key]) return this._queries[key].entities
    
    return this._entities.filter(e => components.every(c => !!e[c.name]))
  }

  public register(system: Function, ...components: Component<unknown>[]): void {
    const key = this.makeQueryKey(...components)
    this._systems.push([system, key])
    this._queries[key] = { components, entities: [], callbacks: [] }
  }

  public query(...components: Component<unknown>[]): Entity[] {
    const key = this.makeQueryKey(...components)
    return this.queryWithKey(key, ...components)
  }

  public subscribe(components: Component<unknown>[], callback: QueryCallback, emit: boolean = false): Function {
    const key = this.makeQueryKey(...components)
    const entities = this.queryWithKey(key, ...components)
    if (!!this._queries[key]) this._queries[key].callbacks.push(callback)
    else this._queries[key] = {
      components,
      entities,
      callbacks: [callback]
    }
    if(emit) callback(entities)
    return () => {
      if(!!this._queries[key]) {
        this._queries[key].callbacks.splice(this._queries[key].callbacks.indexOf(callback), 1)
      }
    }
  }

  public unsubscribe(components: Component<unknown>[], callback: QueryCallback): void {
    const key = this.makeQueryKey(...components)
    if(!!this._queries[key]) {
      this._queries[key].callbacks.splice(this._queries[key].callbacks.indexOf(callback), 1)
    }
  }

  public createEntity(...components: [Component<unknown>, ...any[]][]): Entity {
    const entity: Entity = {}

    components.forEach(([Constructor, ...args]) => {
      entity[Constructor.name] = new (Constructor as ClassComponent<unknown>)(...args)
    })

    this._entities.push(entity)

    Object.values(this._queries).forEach(query => {
      if (query.components.every(c => !!entity[c.name])) {
        query.entities.push(entity)
      }

      query.callbacks.forEach(fn => fn(query.entities))
    })

    return entity
  }

  public addComponent(entity: Entity, ...components: [Component<unknown>, ...any[]][]) {
    if (!~components.length) return
    components.forEach(([Constructor, ...args]) => {
      entity[Constructor.name] = new (Constructor as ClassComponent<unknown>)(...args)
    })
    Object.values(this._queries).forEach(query => {
      if (!query.entities.includes(entity)) {
        if(query.components.every(c => !!entity[c.name])) {
          query.entities.push(entity)
          query.callbacks.forEach(fn => fn(query.entities))
        }
      }
    })
  }

  public updateComponent<T>(entity: Entity, Component, updater: (component: T) => T): void {
    entity[Component.name] = updater(entity[Component.name]) || entity[Component.name]
    Object.values(this._queries).forEach(query => {
      if (query.entities.includes(entity)) {
        query.callbacks.forEach(fn => fn(query.entities))
      }
    })
  }

  public removeComponent(entity: Entity, ...components: Component<unknown>[]) {
    if (!~components.length) return
    components.forEach(component => {
      delete entity[component.name]
    })
    Object.values(this._queries).forEach(query => {
      if (!query.entities.includes(entity)) return

      if(!query.components.every(c => !!entity[c.name])) {
        query.entities.splice(query.entities.indexOf(entity), 1)
        query.callbacks.forEach(fn => fn(query.entities))
      }
    })
    if (!~Object.keys(entity).length) this._entities.splice(this._entities.indexOf(entity), 1)
  }

  public async run(...args: any[]): Promise<void> {
    if (this.config.onBefore) await this.config.onBefore(...args)
    if(!this.config.parallel) {
      for(let [system, queryKey] of this._systems) {
        if(args) await system(...args, this._queries[queryKey].entities)
        else await system(this._queries[queryKey].entities)
      } 
    } else {
      this._systems.forEach(([system, queryKey]) => {
        if(args) system(...args, this._queries[queryKey].entities)
        else system(this._queries[queryKey].entities)
      })
    }
    if (this.config.onAfter) await this.config.onAfter(...args)
  }
}
