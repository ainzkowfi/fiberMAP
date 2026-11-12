import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * One throw anywhere in the app used to unmount the whole tree and leave the
 * crew on a white screen in the field. The records are in IndexedDB and survive
 * a reload, so the recovery is one button.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="panel">
        <div className="stack" style={{ padding: 20 }}>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Your lines, cuts and repairs are still saved on this device. Reload
            to keep working.
          </p>
          <pre className="code">{error.message}</pre>
          <button
            className="btn primary block"
            onClick={() => window.location.reload()}
          >
            Reload fiberMAP
          </button>
        </div>
      </div>
    );
  }
}
