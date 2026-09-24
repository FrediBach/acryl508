export type History<T> = { past: T[]; present: T; future: T[]; group?: T };
export type HistoryAction<T> = { type: "set"; value: T | ((current: T) => T) } | { type: "undo" | "redo" | "begin" | "end" } | { type: "reset"; value: T };
const append = <T,>(items: T[], item: T) => [...items.slice(-49), item];
export function historyReducer<T>(state: History<T>, action: HistoryAction<T>): History<T> {
  if (action.type === "reset") return { past: [], present: action.value, future: [] };
  if (action.type === "begin") return state.group === undefined ? { ...state, group: state.present } : state;
  if (action.type === "end") return state.group === undefined ? state : {
    ...state, group: undefined, past: state.group === state.present ? state.past : append(state.past, state.group),
  };
  if (action.type === "set") {
    const present = typeof action.value === "function" ? (action.value as (value: T) => T)(state.present) : action.value;
    if (present === state.present) return state;
    return { ...state, present, past: state.group === undefined ? append(state.past, state.present) : state.past, future: [] };
  }
  const committed = historyReducer(state, { type: "end" });
  if (action.type === "undo") {
    if (!committed.past.length) return committed;
    return { past: committed.past.slice(0, -1), present: committed.past.at(-1)!, future: append(committed.future, committed.present) };
  }
  if (!committed.future.length) return committed;
  return { past: append(committed.past, committed.present), present: committed.future.at(-1)!, future: committed.future.slice(0, -1) };
}
