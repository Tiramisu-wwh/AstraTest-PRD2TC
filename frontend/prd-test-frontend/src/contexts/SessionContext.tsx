import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChatSession } from '../lib/api';
import { message } from 'antd';

interface SessionContextType {
  currentSession: ChatSession | null;
  setCurrentSession: (session: ChatSession | null) => void;
  sessions: ChatSession[];
  setSessions: (sessions: ChatSession[]) => void;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 改进的会话切换逻辑
  const handleSetCurrentSession = (session: ChatSession | null) => {
    if (session && session.id !== currentSession?.id) {
      setCurrentSession(session);
      message.success(`已切换到会话: ${session.title}`);
    } else if (!session) {
      setCurrentSession(null);
    }
  };

  // 从 localStorage 恢复当前会话 - 修复依赖问题
  useEffect(() => {
    const restoreSession = () => {
      const savedSessionId = localStorage.getItem('currentSessionId');
      if (savedSessionId && sessions.length > 0) {
        const session = sessions.find(s => s.id === savedSessionId);
        if (session) {
          setCurrentSession(session);
        } else {
          // 如果保存的会话不存在，清除localStorage
          localStorage.removeItem('currentSessionId');
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, [sessions]);

  // 保存当前会话到 localStorage
  useEffect(() => {
    if (currentSession) {
      localStorage.setItem('currentSessionId', currentSession.id);
    } else if (!isLoading) {
      // 只有在非加载状态下才清除，避免初始化时的闪烁
      localStorage.removeItem('currentSessionId');
    }
  }, [currentSession, isLoading]);

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        setCurrentSession: handleSetCurrentSession,
        sessions,
        setSessions,
        isLoading,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};