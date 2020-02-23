declare type Entity = {};
interface Component<T> {
    new (...args: any): T;
    name: string;
}
declare type QueryCallback = (entities: Entity[]) => void;
interface Config {
    parallel?: boolean;
    onBefore?: (...args: any[]) => Promise<void>;
    onAfter?: (...args: any[]) => Promise<void>;
}
export declare function getComponent<T>(entity: Entity, Component: Component<T>): T;
export declare function hasComponent<T>(entity: Entity, components: Component<T>): boolean;
export declare function hasComponents(entity: Entity, components: Component<unknown>[]): boolean;
export default class World {
    protected config: Config;
    private _systems;
    private _entities;
    private _queries;
    constructor(config?: Config);
    protected makeQueryKey(components: Component<unknown>[]): string;
    protected queryWithKey(key: any, components: Component<unknown>[]): Entity[];
    private _handleAddCallbacks;
    private _handleRemoveCallbacks;
    addComponent<T>(entity: Entity, Component: Component<T>, ...args: any[]): void;
    addComponents(entity: Entity, components: [Component<unknown>, ...any[]][]): void;
    createEntity(components: [Component<unknown>, ...any[]][]): Entity;
    query(components: Component<unknown>[]): Entity[];
    register(system: Function, components: Component<unknown>[]): void;
    removeComponent<T>(entity: Entity, component: Component<T>): void;
    removeComponents(entity: Entity, components: Component<unknown>[]): void;
    run(...args: any[]): Promise<void>;
    subscribe(components: Component<unknown>[], callback: QueryCallback, emit?: boolean): Function;
    unsubscribe(components: Component<unknown>[], callback: QueryCallback): void;
    updateComponent<T>(entity: Entity, Component: any, updater: (component: T) => T): void;
}
export {};
