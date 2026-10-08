// Font shims must be installed before Excalidraw creates its font faces.
import './ui/fonts';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@excalidraw/excalidraw/index.css';
import './ui/styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
