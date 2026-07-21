import type { Dataset, StatusCode } from './data';

export type ViewId =
  | 'overview'
  | 'map'
  | 'rankings'
  | 'tree'
  | 'endemism'
  | 'matrix'
  | 'explorer'
  | 'insights';

export interface Filter {
  status?: StatusCode;
  kingdom?: string;
  cls?: string;
  family?: string;
  genus?: string;
  juris?: string;
  endemicOf?: string;
  q?: string;
}

export interface Ctx {
  data: Dataset;
  go(view: ViewId): void;
  openExplorer(filter: Filter): void;
  openSpecies(id: string): void;
  openState(code: string): void;
  /** The filter set by the most recent openExplorer() call. */
  getFilter(): Filter;
}

/** A view renders into root and optionally returns a cleanup function. */
export type View = (root: HTMLElement, ctx: Ctx) => void | (() => void);
