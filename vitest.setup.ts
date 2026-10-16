// React 19's `act` (imported from "react") checks this global before running —
// without it, act() calls warn "environment not configured to support act(...)".
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
