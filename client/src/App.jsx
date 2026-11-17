import { Component } from 'react';
import { AppProvider } from './lib/AppContext';
import { ThemeProvider } from './lib/ThemeContext';
import AppRouter from './routes/AppRouter';
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>Halaman belum berhasil dimuat.</h1>
        <p>Muat ulang untuk melanjutkan perjalanan belajarmu.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppProvider>
          <AppRouter />
        </AppProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
