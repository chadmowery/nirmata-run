import { StateConfig, TransitionTable } from './types';

export class StateMachine<TState extends string, TContext = void> {
  private currentState: TState;
  private stateConfigs: Record<TState, StateConfig<TState, TContext>>;
  private allowedTransitions: Map<TState, Set<TState>>;
  private context: TContext;

  constructor(
    initialState: TState,
    stateConfigs: Record<TState, StateConfig<TState, TContext>>,
    transitionTable: TransitionTable<TState>,
    context?: TContext
  ) {
    this.currentState = initialState;
    this.stateConfigs = stateConfigs;
    this.context = context as TContext;
    this.allowedTransitions = new Map();

    for (const [from, to] of transitionTable) {
      if (!this.allowedTransitions.has(from)) {
        this.allowedTransitions.set(from, new Set());
      }
      this.allowedTransitions.get(from)!.add(to);
    }
  }

  public transition(to: TState): boolean {
    if (!this.canTransitionTo(to)) {
      return false;
    }

    const currentConfig = this.stateConfigs[this.currentState];
    if (currentConfig?.onExit) {
      currentConfig.onExit(this.context);
    }

    this.currentState = to;

    const nextConfig = this.stateConfigs[this.currentState];
    if (nextConfig?.onEnter) {
      nextConfig.onEnter(this.context);
    }

    return true;
  }

  public getCurrentState(): TState {
    return this.currentState;
  }

  public canTransitionTo(to: TState): boolean {
    const allowed = this.allowedTransitions.get(this.currentState);
    return allowed?.has(to) ?? false;
  }

  public setContext(context: TContext): void {
    this.context = context;
  }
}
