// src/addon.ts

import { config } from "../package.json";
import { ColumnOptions, DialogHelper } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";

type ZToolkit = any; // 仮の型

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
      columns: Array<ColumnOptions>;
      rows: Array<{ [dataKey: string]: string }>;
    };
    dialog?: DialogHelper;
    activeTabId: string | null;
    inactivePdfTimers: Map<string, number>; // ★ タイマーIDを管理するMapを追加 (キー: tabId, 値: timerId)
  };
  public hooks: typeof hooks;
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      ztoolkit: createZToolkit(),
      activeTabId: null,
      inactivePdfTimers: new Map<string, number>(), // ★ Mapを初期化
    };
    this.hooks = hooks;
    this.api = {};
    // ... (グローバル登録など)
  }
}

export default Addon;
