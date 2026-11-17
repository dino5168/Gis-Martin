import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { parseConfig } from './config';
import { preloadMakiGlyphs } from './map/makiGlyphs';
import { configureMapLibreWorker } from './map/worker';
import './styles.css';

configureMapLibreWorker();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root element not found in index.html');
}
const root = rootElement;

const config = parseConfig(import.meta.env, import.meta.env.PROD);

// 先把 Maki 圖示轉成點陣圖（十幾個小 SVG，約數十 ms），地圖建立後即可同步產生 POI 圖示
const failed = await preloadMakiGlyphs();
if (failed.length > 0) {
  console.warn(`Maki 圖示載入失敗，改以圓點顯示：${failed.join(', ')}`);
}

createRoot(root).render(
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
