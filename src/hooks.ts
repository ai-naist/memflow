import {
  BasicExampleFactory,
  HelperExampleFactory,
  KeyExampleFactory,
  PromptExampleFactory,
  UIExampleFactory,
} from "./modules/examples";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  Zotero.debug(
    `[${addon.data.config.addonName}] onStartup hook called! Plugin is starting.`,
  );

  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  BasicExampleFactory.registerPrefs();

  BasicExampleFactory.registerNotifier();

  KeyExampleFactory.registerShortcuts();

  await UIExampleFactory.registerExtraColumn();

  await UIExampleFactory.registerExtraColumnWithCustomCell();

  UIExampleFactory.registerItemPaneCustomInfoRow();

  UIExampleFactory.registerItemPaneSection();

  UIExampleFactory.registerReaderItemPaneSection();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  // @ts-ignore This is a moz feature
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  await Zotero.Promise.delay(1000);
  popupWin.changeLine({
    progress: 30,
    text: `[30%] ${getString("startup-begin")}`,
  });

  UIExampleFactory.registerStyleSheet(win);

  UIExampleFactory.registerRightClickMenuItem();

  UIExampleFactory.registerRightClickMenuPopup(win);

  UIExampleFactory.registerWindowMenuWithSeparator();

  PromptExampleFactory.registerNormalCommandExample();

  PromptExampleFactory.registerAnonymousCommandExample(win);

  PromptExampleFactory.registerConditionalCommandExample();

  await Zotero.Promise.delay(1000);

  popupWin.changeLine({
    progress: 100,
    text: `[100%] ${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(5000);

  // addon.hooks.onDialogEvents("dialogExample");
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // Log all notifications for debugging
  addon.data.ztoolkit.log(
    "Received notification:",
    event,
    type,
    ids,
    extraData,
  );

  // --- Tab Selection Handling ---
  if (event === "select" && type === "tab" && ids.length > 0) {
    const newActiveTabId = ids[0].toString(); // IDを文字列に変換
    const previouslyActiveTabId = addon.data.activeTabId;

    // Only process if the active tab actually changed
    if (newActiveTabId !== previouslyActiveTabId) {
      addon.data.ztoolkit.log(
        `Tab changed: ${previouslyActiveTabId || "none"} -> ${newActiveTabId}`,
      );

      // Process the tab that became inactive
      if (previouslyActiveTabId) {
        handleTabBecameInactive(previouslyActiveTabId);
      }

      // Process the tab that became active
      handleTabBecameActive(newActiveTabId);

      // Update the currently active tab ID
      addon.data.activeTabId = newActiveTabId;
    }
  }
  // --- End Tab Selection Handling ---

  // --- Keep original example code if needed, otherwise remove ---
  // else if (
  //   event == "select" && // Original example condition
  //   type == "tab" &&
  //   extraData[ids[0]]?.type == "reader" // Use optional chaining for safety
  // ) {
  //   BasicExampleFactory.exampleNotifierCallback();
  // }
  // --- End original example code ---

  // Handle other notification types if necessary
  // else if (event === 'item' && type === 'modify') {
  //   // Handle item modification
  // }
}

// --- Helper function to get delay from preferences ---
function getTimerDelayMs(): number {
  try {
    const minutes = Zotero.Prefs.get(
      addon.data.config.prefsPrefix + ".delayMinutes",
      true,
    ); // Get preference value
    if (typeof minutes === "number" && minutes >= 1) {
      // 分をミリ秒に変換
      return minutes * 60 * 1000;
    }
  } catch (e) {
    addon.data.ztoolkit.log(
      "Error reading delayMinutes preference:",
      e,
      "error",
    );
  }
  // デフォルト値またはエラー時のフォールバック (例: 1分)
  const defaultMinutes = 1;
  addon.data.ztoolkit.log(
    `Using default timer delay: ${defaultMinutes} minutes`,
    "warn",
  );
  return defaultMinutes * 60 * 1000;
}

// --- Helper function to check if plugin is enabled ---
function isPluginEnabled(): boolean {
  try {
    // 第2引数 true は、設定が存在しない場合にエラーを投げずに undefined を返すようにするため
    // (ただし、prefs.js でデフォルトが設定されていれば通常は不要)
    const enabled = Zotero.Prefs.get(
      addon.data.config.prefsPrefix + ".enabled",
      true,
    );
    // Zotero.Prefs.get は値が見つからない場合にデフォルト値を返さないことがあるため、明示的にチェック
    return typeof enabled === "boolean" ? enabled : true; // デフォルトは有効
  } catch (e) {
    addon.data.ztoolkit.log("Error reading enabled preference:", e, "error");
    return true; // エラー時はデフォルトで有効とする
  }
}

/**
 * Called when a tab becomes inactive.
 * @param tabId The ID of the tab that became inactive.
 */
async function handleTabBecameInactive(tabId: string): Promise<void> {
  // ★ Check if plugin is enabled first
  if (!isPluginEnabled()) {
    addon.data.ztoolkit.log(
      "MemFlow plugin is disabled in preferences. Skipping.",
    );
    return;
  }

  try {
    if (
      typeof Zotero.Reader === "undefined" ||
      typeof Zotero.Reader.getByTabID !== "function"
    ) {
      addon.data.ztoolkit.log(
        "Zotero.Reader.getByTabID is not available.",
        "warn",
      );
      return;
    }

    const readerInstance = await Zotero.Reader.getByTabID(tabId);

    if (readerInstance && readerInstance.type === "pdf") {
      const currentDelayMs = getTimerDelayMs();
      addon.data.ztoolkit.log(
        `Tab ${tabId} confirmed as PDF Reader. Starting memory release timer (${currentDelayMs / 1000 / 60} minutes).`,
      );

      // --- Start Timer ---
      // Check if a timer already exists for this tab (should not happen in normal flow, but for safety)
      if (addon.data.inactivePdfTimers.has(tabId)) {
        addon.data.ztoolkit.log(
          `Timer already exists for tab ${tabId}. Clearing old timer.`,
          "warn",
        );
        clearTimeout(addon.data.inactivePdfTimers.get(tabId));
      }

      // Set a new timer
      const timerId = setTimeout(() => {
        handleTimerCompletion(tabId);
      }, currentDelayMs);

      // Store the timer ID in the map
      addon.data.inactivePdfTimers.set(tabId, timerId as unknown as number); // setTimeout returns Timeout in Node, number in browsers. Cast for safety.
      addon.data.ztoolkit.log(
        `Timer ${timerId} started for inactive PDF tab ${tabId}.`,
      );
      addon.data.inactivePdfTimers.set(tabId, timerId as unknown as number);
      addon.data.ztoolkit.log(
        `Timer ${timerId} started for inactive PDF tab ${tabId}.`,
      );
      // --- End Timer Start ---
    } else {
      if (readerInstance) {
        addon.data.ztoolkit.log(
          `Tab ${tabId} is a reader, but not PDF type. Skipping timer.`,
        );
      } else {
        addon.data.ztoolkit.log(
          `Tab ${tabId} is not a Zotero Reader tab. Skipping timer.`,
        );
      }
    }
  } catch (error) {
    addon.data.ztoolkit.log(
      `Error in handleTabBecameInactive for ${tabId}:`,
      error,
      "error",
    );
  }
}

/**
 * Called when a tab becomes active.
 * @param tabId The ID of the tab that became active.
 */
function handleTabBecameActive(tabId: string): void {
  addon.data.ztoolkit.log(
    `Tab ${tabId} became active. Checking for pending timers...`,
  );

  // --- Cancel Timer ---
  // Check if there is a timer running for this tab
  if (addon.data.inactivePdfTimers.has(tabId)) {
    const timerId = addon.data.inactivePdfTimers.get(tabId);
    clearTimeout(timerId);
    addon.data.inactivePdfTimers.delete(tabId); // Remove the entry from the map
    addon.data.ztoolkit.log(
      `Cancelled timer ${timerId} for tab ${tabId} as it became active.`,
    );
  } else {
    addon.data.ztoolkit.log(`No pending timer found for active tab ${tabId}.`);
  }
  // --- End Timer Cancel ---
}

/**
 * Called when the memory release timer for an inactive PDF tab completes.
 * @param tabId The ID of the tab whose timer completed.
 */
function handleTimerCompletion(tabId: string): void {
  // First, check if the timer entry still exists in the map.
  // It might have been cancelled just before this callback executed.
  // Also remove the entry from the map as the timer has completed.
  if (!isPluginEnabled()) {
    addon.data.ztoolkit.log(
      `Timer completed for tab ${tabId}, but plugin is now disabled. Aborting release action.`,
    );
    // Ensure timer entry is removed even if action is aborted
    if (addon.data.inactivePdfTimers.has(tabId)) {
      addon.data.inactivePdfTimers.delete(tabId);
    }
    return;
  }
  const timerId = addon.data.inactivePdfTimers.get(tabId);
  addon.data.inactivePdfTimers.delete(tabId); // Remove after completion

  addon.data.ztoolkit.log(
    `Timer ${timerId} completed for inactive PDF tab ${tabId}.`,
  );
  addon.data.ztoolkit.log(
    `Proceeding with memory release logic for tab ${tabId}...`,
  );

  // --- Memory Release Logic (Step 6) ---
  // TODO (Step 6): Implement the actual memory release mechanism here.
  // For now, just log a message.
  addon.data.ztoolkit.log(
    `[MemFlow Action] Attempting to release resources for tab ${tabId}. (Currently logging only)`,
  );
  // Example (Placeholder for Step 6):
  // tryCloseTab(tabId); // Example function call
  // --- End Memory Release Logic ---
}
/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
// --- グローバル変数として保持するUI要素 (Unload時にリスナー削除するため) ---
let prefsWindowElements: {
  delayInput?: HTMLInputElement | null;
  delayInputListener?: () => void; // イベントリスナー自体を保持
} | null = null;

/**
 * Dispatcher for Preference UI events.
 * @param type event type ('load', 'unload')
 * @param data event data ({ window, document })
 */
async function onPrefsEvent(
  type: string,
  data: { window: Window; document: Document },
) {
  const { window, document } = data;
  const ztoolkit = addon.data.ztoolkit; // Use the toolkit

  switch (type) {
    case "load": {
      ztoolkit.log("Preferences pane loading...");
      prefsWindowElements = {}; // Reset elements tracker

      // --- Get UI Elements ---
      const delayInput = document.getElementById(
        "memflow-delay-input",
      ) as HTMLInputElement | null;
      prefsWindowElements.delayInput = delayInput;
      const enabledCheckbox = document.getElementById(
        "memflow-enabled-checkbox",
      ); // チェックボックスも取得（ログ用）

      ztoolkit.log("Pref UI Elements:", { delayInput, enabledCheckbox });

      // --- Load Initial Values ---
      if (delayInput) {
        try {
          // Zotero.Prefs.get を直接使うか、Toolkitのヘルパーを使う
          const delayMinutes = Zotero.Prefs.get(
            addon.data.config.prefsPrefix + ".delayMinutes",
            true,
          );
          delayInput.value = (
            typeof delayMinutes === "number" ? delayMinutes : 5
          ).toString(); // デフォルト5
          ztoolkit.log(`Loaded delayMinutes: ${delayInput.value}`);
        } catch (e) {
          ztoolkit.log("Error loading delayMinutes pref", e, "error");
        }
      }
      // チェックボックスの値は preference 属性で自動ロードされるはずだが、ログ用に取得
      try {
        const enabled = Zotero.Prefs.get(
          addon.data.config.prefsPrefix + ".enabled",
          true,
        );
        ztoolkit.log(`Loaded enabled: ${enabled}`);
      } catch (e) {
        ztoolkit.log("Error loading enabled pref", e, "error");
      }

      // --- Add Event Listeners ---
      if (delayInput) {
        const listener = () => {
          // リスナー関数を定義
          if (!prefsWindowElements?.delayInput) return;
          let value = parseInt(prefsWindowElements.delayInput.value, 10);
          if (isNaN(value) || value < 1) {
            value = 1;
            prefsWindowElements.delayInput.value = value.toString();
          }
          try {
            // Zotero.Prefs.set を直接使うか、Toolkitのヘルパーを使う
            Zotero.Prefs.set(
              addon.data.config.prefsPrefix + ".delayMinutes",
              value,
            );
            ztoolkit.log(`Saved delayMinutes: ${value}`);
          } catch (e) {
            ztoolkit.log("Error saving delayMinutes pref", e, "error");
          }
        };
        prefsWindowElements.delayInputListener = listener; // リスナーを保存
        delayInput.addEventListener("input", listener);
        delayInput.addEventListener("change", listener);
        ztoolkit.log("Added event listeners for delay input.");
      }

      ztoolkit.log("Preferences pane loaded.");
      break;
    }
    case "unload": {
      ztoolkit.log("Preferences pane unloading...");
      // --- Remove Event Listeners ---
      if (
        prefsWindowElements?.delayInput &&
        prefsWindowElements.delayInputListener
      ) {
        prefsWindowElements.delayInput.removeEventListener(
          "input",
          prefsWindowElements.delayInputListener,
        );
        prefsWindowElements.delayInput.removeEventListener(
          "change",
          prefsWindowElements.delayInputListener,
        );
        ztoolkit.log("Removed event listeners for delay input.");
      }
      prefsWindowElements = null; // Clean up
      ztoolkit.log("Preferences pane unloaded.");
      break;
    }
    default:
      return;
  }
}

function onShortcuts(type: string) {
  switch (type) {
    case "larger":
      KeyExampleFactory.exampleShortcutLargerCallback();
      break;
    case "smaller":
      KeyExampleFactory.exampleShortcutSmallerCallback();
      break;
    default:
      break;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    case "dialogExample":
      HelperExampleFactory.dialogExample();
      break;
    case "clipboardExample":
      HelperExampleFactory.clipboardExample();
      break;
    case "filePickerExample":
      HelperExampleFactory.filePickerExample();
      break;
    case "progressWindowExample":
      HelperExampleFactory.progressWindowExample();
      break;
    case "vtableExample":
      HelperExampleFactory.vtableExample();
      break;
    default:
      break;
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  // onNotify,
  onPrefsEvent,
  onShortcuts,
  // onDialogEvents,
};
