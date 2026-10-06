// Font shims must be installed before Excalidraw creates its font faces.
import './fonts';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@excalidraw/excalidraw/index.css';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
