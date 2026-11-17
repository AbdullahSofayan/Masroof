import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App, { ErrorBoundary } from './App';
import { AuthProvider } from './context/AuthContext';
import { NoticeProvider } from './context/NoticeContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><BrowserRouter><AuthProvider><NoticeProvider><App /></NoticeProvider></AuthProvider></BrowserRouter></ErrorBoundary></React.StrictMode>);
