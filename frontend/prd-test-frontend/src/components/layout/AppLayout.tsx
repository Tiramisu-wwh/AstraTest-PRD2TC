import React, { useState } from 'react';
import { Layout, Menu, Button, Drawer, Typography, message } from 'antd';
import {
  FileTextOutlined,
  ExperimentOutlined,
  SettingOutlined,
  PlusOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useSessions, useCreateSession } from '../../hooks/useApi';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSession, setCurrentSession, sessions, setSessions, isLoading } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { data: sessionsData } = useSessions();
  const createSessionMutation = useCreateSession();

  // 监听创建新会话事件
  React.useEffect(() => {
    const handleCreateNewSession = () => {
      handleCreateSession();
    };

    window.addEventListener('createNewSession', handleCreateNewSession);
    return () => {
      window.removeEventListener('createNewSession', handleCreateNewSession);
    };
  }, []);

  React.useEffect(() => {
    if (sessionsData) {
      setSessions(sessionsData);
    }
  }, [sessionsData, setSessions]);

  const handleCreateSession = async () => {
    try {
      const timestamp = new Date().toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const newSession = await createSessionMutation.mutateAsync(`分析会话 ${timestamp}`);
      setCurrentSession(newSession);
      // 不再强制跳转，让用户在当前页面继续操作
      message.success('新会话已创建，可以开始上传文档');
    } catch (error) {
      console.error('创建会话失败:', error);
      message.error('创建会话失败，请重试');
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: '文档上传',
    },
    {
      key: '/test-cases',
      icon: <ExperimentOutlined />,
      label: '测试用例',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'AI配置',
    },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200">
        <Title level={4} className="!mb-2 text-blue-600">
          PRD测试系统
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateSession}
          loading={createSessionMutation.isPending}
          className="w-full"
          size="small"
        >
          新建会话
        </Button>
      </div>

      {/* 导航菜单 */}
      <div className="flex-1 overflow-y-auto">
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            if (isMobile) {
              setMobileDrawerOpen(false);
            }
          }}
          className="border-r-0"
        />

        {/* 会话列表 */}
        <div className="p-4">
          <Text strong className="text-gray-500 text-xs uppercase">
            历史会话
          </Text>
          <div className="mt-2 space-y-1">
            {(Array.isArray(sessions) ? sessions : []).slice(0, 10).map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentSession(session)}
                className={`
                  p-2 rounded cursor-pointer text-sm transition-colors
                  hover:bg-blue-50
                  ${
                    currentSession?.id === session.id
                      ? 'bg-blue-100 text-blue-600 border border-blue-200'
                      : 'text-gray-600'
                  }
                `}
              >
                <div className="truncate font-medium">{session.title}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(session.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <div className="p-4 border-t border-gray-200">
        {currentSession && (
          <div className="text-xs text-gray-500">
            当前会话: {currentSession.title}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Layout className="min-h-screen">
        <Header className="bg-white shadow-sm px-4 flex items-center justify-between">
          <Title level={4} className="!mb-0 text-blue-600">
            PRD测试系统
          </Title>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileDrawerOpen(true)}
          />
        </Header>
        
        <Content className="p-4">
          {children}
        </Content>

        <Drawer
          title={null}
          placement="left"
          onClose={() => setMobileDrawerOpen(false)}
          open={mobileDrawerOpen}
          styles={{ body: { padding: 0 } }}
          width={280}
        >
          {sidebarContent}
        </Drawer>
      </Layout>
    );
  }

  return (
    <Layout className="min-h-screen">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={280}
        className="bg-white shadow-sm"
        trigger={null}
      >
        {sidebarContent}
      </Sider>
      
      <Layout>
        <Header className="bg-white shadow-sm px-6 flex items-center justify-between">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          
          <div className="text-gray-600">
            基于AI的PRD文档测试用例自动生成系统
          </div>
        </Header>
        
        <Content className="p-6 bg-gray-50">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;