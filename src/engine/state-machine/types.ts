// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface StateConfig<TState extends string, TContext = void> {
  onEnter?: (context: TContext) => void;
  onExit?: (context: TContext) => void;
}

export type TransitionTable<TState extends string> = Array<[TState, TState]>;
