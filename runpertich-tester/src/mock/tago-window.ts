/**
 * window.TagoIO mock for the virtual dashboard.
 *
 * The production Dashboard.tsx calls TagoIO.onStart(), onRealtime(), then
 * ready() to initialise. It guards the whole block with:
 *   if (!TagoIO || !TagoIO.ready) { use local preview mode }
 *
 * We must expose ready / onStart / onRealtime so the Dashboard enters the
 * real TagoIO path and its onRealtime callback is registered.
 *
 * Timing: Dashboard registers onRealtime inside useEffect (child), which fires
 * BEFORE the parent's useEffect (where we call pushDataAtTime). So by the time
 * we push data, the callback is already registered — no pending queue needed
 * in the normal case. We keep _pendingData as a safety net for any edge case
 * where the order flips (e.g. first mount before lazy load completes).
 */

declare global {
  interface Window {
    TagoIO: any;
  }
}

type RealtimeCallback = (buckets: unknown[]) => void;
type StartCallback = (widget: any) => void;

let _realtimeCallback: RealtimeCallback | null = null;
let _onStartCallback: StartCallback | null = null;
let _pendingData: unknown[] | null = null;

export function setupTagoWindow(): void {
  _realtimeCallback = null;
  _onStartCallback = null;
  _pendingData = null;

  window.TagoIO = {
    /** Called by Dashboard to set up configuration / initial data */
    onStart: (cb: StartCallback) => {
      _onStartCallback = cb;
    },

    /** Called by Dashboard to register its real-time data handler */
    onRealtime: (cb: RealtimeCallback) => {
      _realtimeCallback = cb;
      // Deliver any data that arrived before registration
      if (_pendingData) {
        cb([{ result: _pendingData }]);
        _pendingData = null;
      }
    },

    /**
     * Called by Dashboard after onStart / onRealtime to signal it is ready.
     * We use this to fire the onStart callback with a minimal widget object
     * so the Dashboard initialises its tables/params with safe defaults.
     */
    ready: () => {
      if (_onStartCallback) {
        _onStartCallback({ display: { parameters: [] }, data: [] });
      }
    },

    sendData: (data: unknown) => {
      console.log("[TagoIO mock] sendData:", data);
    },

    init: () => {},
    data: [],
  };
}

export function pushRealtimeData(dataPoints: unknown[]): void {
  if (!_realtimeCallback) {
    // Dashboard hasn't registered yet — store until it does
    _pendingData = dataPoints;
    return;
  }
  _realtimeCallback([{ result: dataPoints }]);
}

export function hasRealtimeCallback(): boolean {
  return _realtimeCallback !== null;
}
