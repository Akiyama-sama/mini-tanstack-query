"use client"; // React 19 / Next.js 必备，标记为客户端组件

import { useSyncExternalStore, useEffect } from "react";

// ==========================================
// 1. 核心层：Query (保持不变 - 逻辑纯粹)
// ==========================================
interface QueryState<T> {
  data: T | undefined;
  status: "loading" | "success" | "error";
  error: any;
}

class Query<T> {
  queryKey: string;
  queryFn: () => Promise<T>;
  state: QueryState<T>;
  subscribers: Set<() => void>;
  promise: Promise<T> | null;

  constructor(key: string, fn: () => Promise<T>) {
    this.queryKey = key;
    this.queryFn = fn;
    this.subscribers = new Set();
    this.promise = null;
    this.state = { data: undefined, status: "loading", error: null };
  }

  subscribe = (callback: () => void) => {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  };

  // 获取当前快照 (Snapshot)
  getSnapshot = () => {
    return this.state;
  };

  setState(updater: (old: QueryState<T>) => QueryState<T>) {
    this.state = updater(this.state);
    this.subscribers.forEach((cb) => cb());
  }

  fetch() {
    if (this.promise) return this.promise;

    this.setState((s) => ({ ...s, status: "loading" }));

    this.promise = this.queryFn()
      .then((data) => {
        this.setState((s) => ({ ...s, data, status: "success" }));
        return data;
      })
      .catch((error) => {
        this.setState((s) => ({ ...s, error, status: "error" }));
        throw error;
      })
      .finally(() => {
        this.promise = null;
      });

    return this.promise;
  }
}

// ==========================================
// 2. 管理层：QueryClient (保持不变)
// ==========================================
export class QueryClient {
  queries: Map<string, Query<any>>;

  constructor() {
    this.queries = new Map();
  }

  getQuery<T>(key: string[], fn: () => Promise<T>): Query<T> {
    const queryHash = JSON.stringify(key);
    if (!this.queries.has(queryHash)) {
      this.queries.set(queryHash, new Query(queryHash, fn));
    }
    return this.queries.get(queryHash)!;
  }
}

// ==========================================
// 3. 适配层：useQuery Hook (React 19 升级版)
// ==========================================
export const client = new QueryClient();

export function useQuery<T>(key: string[], fn: () => Promise<T>) {
  // 1. 获取 Query 实例
  const query = client.getQuery(key, fn);

  // 2. 使用 React 官方的外部存储同步钩子
  // 参数1: subscribe 函数 (当 store 变化时通知 React)
  // 参数2: getSnapshot 函数 (React 获取当前数据的快照)
  const state = useSyncExternalStore(
    query.subscribe, 
    query.getSnapshot
  );

  // 3. 触发请求的副作用
  // 注意：useSyncExternalStore 只负责"读"和"更新视图"，"发起请求"依然是副作用
  useEffect(() => {
    // 只有当：正在 loading + 没数据 + 没有正在进行的请求 时，才发起
    if (state.status === "loading" && !state.data && !query.promise) {
      query.fetch();
    }
  }, [query, state.status, state.data]); 

  return state;
}
