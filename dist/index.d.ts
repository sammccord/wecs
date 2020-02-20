declare type Entity = {};
interface ClassComponent<T> {
    new (...args: any): T;
    name: string;
}
declare type Component<T> = ClassComponent<T> | Function;
declare type QueryCallback = (...entities: Entity[]) => void;
interface Config {
    parallel?: boolean;
    onBefore?: (msg?: any) => Promise<void>;
    onAfter?: (msg?: any) => Promise<void>;
}
export declare function getComponent<T>(entity: Entity, Component: Component<T>): T;
export declare function hasComponent(entity: Entity, ...components: Component<unknown>[]): boolean;
export default class World {
    protected config: Config;
    private _systems;
    private _entities;
    private _queries;
    constructor(config?: Config);
    protected makeQueryKey(...components: Component<unknown>[]): string;
    protected queryWithKey(key: any, ...components: Component<unknown>[]): Entity[];
    register(system: Function, ...components: Component<unknown>[]): void;
    query(...components: Component<unknown>[]): Entity[];
    subscribe(components: Component<unknown>[], callback: QueryCallback, emit?: boolean): Function;
    createEntity(...components: [Component<unknown>, ...any[]][]): Entity;
    addComponent(entity: Entity, ...components: [Component<unknown>, ...any[]][]): void;
    removeComponent(entity: Entity, ...components: Component<unknown>[]): void;
    run(msg?: any): Promise<void>;
}
export {};
