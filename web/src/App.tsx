import React, { useState } from 'react';
import { Tabs, Layout, theme } from 'antd';
import { MessageOutlined, SettingOutlined } from '@ant-design/icons';
import ChatPage from './pages/ChatPage';
import ConfigPage from './pages/ConfigPage';

const { Header, Content } = Layout;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const items = [
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined />
          聊天
        </span>
      ),
      children: <ChatPage />,
    },
    {
      key: 'config',
      label: (
        <span>
          <SettingOutlined />
          配置
        </span>
      ),
      children: <ConfigPage />,
    },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ 
        padding: '0 24px', 
        background: colorBgContainer,
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 100
      }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
          🐈 nanobot-node
        </div>
      </Header>
      <Content>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          style={{ height: 'calc(100vh - 64px)' }}
        />
      </Content>
    </Layout>
  );
};

export default App;
