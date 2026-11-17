import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { parseConfig } from './config';
import { configureMapLibreWorker } from './map/worker';
import './styles.css';

configureMapLibreWorker();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root element not found in index.html');
}

const config = parseConfig(import.meta.env);

createRoot(rootElement).render(
  <StrictMode>
    {config.error ? (
      <div className="config-error" role="alert">
        <h1>設定錯誤</h1>
        <p>{config.error.message}</p>
      </div>
    ) : (
      <App config={config.data} />
    )}
  </StrictMode>,
);
