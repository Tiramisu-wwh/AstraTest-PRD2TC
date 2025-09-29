import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { queryClient } from './lib/query-client';
import { SessionProvider } from './contexts/SessionContext';
import { AppProvider } from './contexts/AppContext';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import TestCasesPage from './pages/TestCasesPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <AppProvider>
          <SessionProvider>
            <Router>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/test-cases" element={<TestCasesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AppLayout>
            </Router>
          </SessionProvider>
        </AppProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;