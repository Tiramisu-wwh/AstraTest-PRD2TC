import React, { createContext, useContext, useState } from 'react';
import { Spin, Result, Button } from 'antd';

interface AppContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  showError: (error: string, retry?: () => void) => void;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
  };

  const showError = (errorMessage: string, retry?: () => void) => {
    setError({ message: errorMessage, retry });
  };

  const clearError = () => {
    setError(null);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Result
          status="error"
          title="操作失败"
          subTitle={error.message}
          extra={
            <div className="space-x-4">
              {error.retry && (
                <Button type="primary" onClick={error.retry}>
                  重试
                </Button>
              )}
              <Button onClick={clearError}>关闭</Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ isLoading, setLoading, showError, clearError }}>
      <Spin spinning={isLoading} tip="处理中..." size="large">
        {children}
      </Spin>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};