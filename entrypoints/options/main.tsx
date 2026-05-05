import React from 'react';
import ReactDOM from 'react-dom/client';
import { Options } from './Options';
import '@/assets/tailwind.css';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>,
  );
}
